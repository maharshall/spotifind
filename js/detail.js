function fillAlbumDetails(albums) {
    for(i in albums) {
        // get necessary info
        var title = albums[i].name;
        var artist = albums[i].artists[0].name;
        var year = albums[i].release_date.slice(0, 4);
        var tracks = albums[i].total_tracks;
        var art = albums[i].images[0].url;
        var id = albums[i].id;

        // populate html
        $(`#album${i}`).show();
        $(`#album${i} .value.title`).html(title);
        $(`#album${i} .value.artist`).html(artist);
        $(`#album${i} .value.year`).html(year);
        $(`#album${i} .value.tracks`).html(tracks);
        $(`#album${i} img`).attr('src', art);
        $(`#album${i} .id`).html(id);

        $(`#album${i}`).click(generateHandler(i));
    }
}

function fillTrackDetails(tracks) {
    $('.songs').show();
    for(i in tracks) {
        var name = tracks[i].name;
        var uri = tracks[i].uri;

        $(`#track${i}`).show();
        $(`#track${i} label`).html((+i+1)+'. '+name);
        $(`#tracks${i} p`).attr('id', uri);
    }
}

function generateHandler(i) {
    return function(event) {
        $('.grid-container').hide();
        $('h2').html($(`#album${i} .value.artist`).html()+' - '+$(`#album${i} .value.title`).html());

        chrome.extension.sendMessage({
            action: 'album_selection',
            data: $(`#album${i} .id`).html()
        },
        (response) => {

        });
    }
}

function getPlaylists(access_token) {
    $.ajax({
        url: 'https://api.spotify.com/v1/me/playlists',
        headers: {
            'Authorization': 'Bearer ' + access_token
        },
        data: {
            limit: 50
        },
        success: function(xhr) {
            for(i in xhr.items) {
                $('#playlists').append('<option value="' + xhr.items[i].id + '">' + xhr.items[i].name + '</option>');
            }
        },
        error: function(xhr) {
            console.error(xhr.responseText);
            if(xhr.status === 401) {
                alert('Your token has expired.\nPlease get a new one through the extension popup');
            }
        }
    })
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if(request.action === 'albums') {
        var albums = JSON.parse(request.data);
        fillAlbumDetails(albums);
    } else if(request.action === 'track_data') {
        var tracks = JSON.parse(request.data);
        fillTrackDetails(tracks);

        chrome.storage.local.get('access_token', (result) => {
            getPlaylists(result.access_token);
        });
    }

    return true;
});

$('#sel_all').click(() => {
    $('input').prop('checked', true);
})

$('#sel_none').click(() => {
    $('input').prop('checked', false);
})