chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if(request.action === 'toast') {
        var data = JSON.parse(request.data);
        createToast(data.message, data.image);
    } else if(request.action === 'albums') {
        fillAlbumDetails(JSON.parse(request.data));
    } else if(request.action === 'track_data') {
        fillTrackDetails(JSON.parse(request.data));
        chrome.storage.local.get('access_token', (result) => {
            getPlaylists(result.access_token);
        });
    }
});

function createToast(message, image) {
    $('body').append('<div id="spotifind_toast"></div>');
    var toast = $('#spotifind_toast');
    if(image) toast.append('<img src="'+image+'" width="100" height ="100">');
    toast.append('<h3>Spotifind</h3>');
    toast.append(message);

    toast.addClass('show');
    setTimeout(() => {
        toast.removeClass('show');
        toast.remove();
    }, 5000);
}

function fillTrackDetails(tracks) {
    var body = $('.spotifind_overlay #body');
    body.append(`
    <div class="songs">
        <button id="sel_all">Select All</button> <button id="sel_none">Select None</button>
    </div>`);

    for(i in tracks) {
        $('#body .songs').append(`
        <div class="track" id="track${i}">
            <input type="checkbox" id="cbox${i}"> 
            <span class="checkmark"></span>
            <label for="cbox${i}"></label> <br>
        </div>`);

        var name = tracks[i].name;
        var uri = tracks[i].uri;

        $(`#track${i}`).show();
        $(`#track${i} label`).html((+i+1)+'. '+name);
        $(`#track${i} input`).attr('name', uri);
    }

    $('#body .songs').append(`
    <div id="playlist_selector">
        <p id="playlist">Add to playlist: 
            <select id="playlists">
            </select>
        </p>
        <button id="go">Go >></button>
    </div>`);
}

function fillAlbumDetails(albums) {
    $('body').append(`
    <div class="spotifind_overlay">
        <div id="body">
            <p id="x">\u008E</p>
        </div>
    </div>`);

    var body = $('.spotifind_overlay #body');
    body.append('<h2>Which Album Were You Looking For?</h2>');
    body.append('<div class="grid-container"></div>');

    for(i in albums) {
        // get necessary info
        var title = albums[i].name;
        var artist = albums[i].artists[0].name;
        var year = albums[i].release_date.slice(0, 4);
        var tracks = albums[i].total_tracks;
        var art = albums[i].images[0].url;
        var id = albums[i].id;

        // create html
        $('#body .grid-container').append(`
        <div class ="album" id="album${i}">
            <img src="" width="123" height="123">
            <p class="tag title">Title: </p>  <p class="value title"></p> <br>
            <p class="tag artist">Artist: </p> <p class="value artist"></p> <br>
            <p class="tag year">Year: </p>   <p class="value year"></p> <br>
            <p class="tag tracks">Tracks: </p> <p class="value tracks"></p> <br>
            <p class="id"></p>
        </div>`);

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

function generateHandler(i) {
    return function(event) {
        $('#body .grid-container').hide();
        $('h2').html($(`#album${i} .value.artist`).html()+' - '+$(`#album${i} .value.title`).html());

        chrome.extension.sendMessage({
            action: 'album_selection',
            data: $(`#album${i} .id`).html()
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

$('.spotifind_overlay #body #x').click(() => {
    $('body .spotifind_overlay').hide();
});

$('.songs #sel_all').click(() => {
    alert('select all');
    $('input').prop('checked', true);
})

$('.songs #sel_none').click(() => {
    $('input').prop('checked', false);
})

$('.songs .track #playlist_selector #go').click(() => {
    alert('clicked')
    var track_data = [];
    $('.songs input:checked').each((index, element) => {
        track_data.push(element.name);
    });

    chrome.extension.sendMessage({
        action: 'track_data',
        tracks: JSON.stringify(track_data),
        playlist: JSON.stringify({
            id: $('.songs #playlist_selector #playlists').val(),
            name: $(".songs #playlist_selector #playlists option:selected").text()
        })
    });
    
    $('body .spotifind_overlay').remove();
})