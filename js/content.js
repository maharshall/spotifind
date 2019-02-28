// link the stylesheet as soon as the script is loaded
(() => {
    var style = document.createElement('link');
    style.rel = 'stylesheet';
    style.type = 'text/css';
    style.href = chrome.extension.getURL('content.css');
    (document.head||document.documentElement).appendChild(style);
})();

// listen for messages from the background script
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

/**
 * Creates a 'toast' notification at the top of the screen
 * @param {string} message  the message for the notification
 * @param {string} image    the image for the notification
 */
function createToast(message, image) {
    $('body').append('<div id="sf_toast"></div>');
    var toast = $('#sf_toast');
    if(image) toast.append('<img id="sf_toast_img" src="'+image+'" width="100" height ="100">');
    toast.append('<h3 id="sf_toast_h3">Spotifind</h3>');
    toast.append(`<p id="sf_toast_message">${message}</p>`);

    toast.addClass('show');
    setTimeout(() => {
        toast.removeClass('show');
        toast.remove();
    }, 5000);
}

/**
 * Creates and populates the html elements for displaying albums
 * @param {array[object]} albums an array of album objects, returned from the Spotify API
 */
function fillAlbumDetails(albums) {
    $('body').append(`
    <div class="sf_overlay">
        <div id="sf_body">
            <button id="sf_close">Close</button>
        </div>
    </div>`);

    closeHandler();
    $(document).keyup(function(e) {
        // close overlay on Esc key
        if (e.keyCode === 27) closeOverlay();
    });

    var body = $('#sf_body');
    body.append('<h2 id="sf_h2">Which Album Were You Looking For?</h2>');
    body.append('<div class="sf_grid-container"></div>');

    for(i in albums) {
        // get necessary info
        var title = albums[i].name;
        var artist = albums[i].artists[0].name;
        var year = albums[i].release_date.slice(0, 4);
        var tracks = albums[i].total_tracks;
        var art = albums[i].images[0].url;
        var id = albums[i].id;

        // create html
        $('.sf_grid-container').append(`
        <div class ="sf_album" id="sf_album${i}">
            <div class="sf_bg_image"></div>
            <img src=${art} style="display: none;">
            <p class="sf_tag title">Title: </p>  <p class="sf_value title"></p> <br>
            <p class="sf_tag artist">Artist: </p> <p class="sf_value artist"></p> <br>
            <p class="sf_tag year">Year: </p>   <p class="sf_value year"></p> <br>
            <p class="sf_tag tracks">Tracks: </p> <p class="sf_value tracks"></p> <br>
            <p class="sf_id"></p>
        </div>`);

        $(`#sf_album${i} .sf_bg_image`).css("background-image", "url("+art+")");

        // populate html
        $(`#sf_album${i}`).show();
        $(`#sf_album${i} .sf_value.title`).html(title);
        $(`#sf_album${i} .sf_value.artist`).html(artist);
        $(`#sf_album${i} .sf_value.year`).html(year);
        $(`#sf_album${i} .sf_value.tracks`).html(tracks);
        $(`#sf_album${i} img`).attr('src', art);
        $(`#sf_album${i} .sf_id`).html(id);

        $(`#sf_album${i}`).click(generateHandler(i));
    }
}

/**
 * Creates and populates the html elements for the track information
 * @param {array[object]} tracks an array of track objects, returned from the Spotify API   
 */
function fillTrackDetails(tracks) {
    var body = $('#sf_body');
    body.prepend('<button id="sf_back">Back</button>');
    backHandler();
    body.append(`<div class="sf_songs"></div>`);

    for(i in tracks) {
        $('.sf_songs').append(`
        <div class="sf_track" id="sf_track${i}">
            <input type="checkbox" id="sf_cbox${i}"> 
            <span class="checkmark"></span>
            <label for="sf_cbox${i}"></label> <br>
        </div>`);

        var name = tracks[i].name;
        var uri = tracks[i].uri;

        $(`#sf_track${i}`).show();
        $(`#sf_track${i} label`).html((+i+1)+'. '+name);
        $(`#sf_track${i} input`).attr('name', uri);
    }

    body.append(`
    <div id="sf_playlist_selector">
        <p id="sf_playlist">Add to playlist: 
            <select id="sf_playlists">
            </select>
        </p>
        <button id="sf_sel_all">Select All</button> <button id="sf_sel_none">Select None</button>
        <button id="sf_go">Go >></button>
    </div>`);
    selectAllHandler();
    selectNoneHandler();
    goHandler();
}

/**
 * After an album is selected, send album id to background script
 * @param {number} i the number used to access the div 
 */
function generateHandler(i) {
    return function(event) {
        $('.sf_grid-container').hide();
        $('#sf_h2').html($(`#sf_album${i} .sf_value.artist`).html()+
        ' - '+$(`#sf_album${i} .sf_value.title`).html());

        chrome.storage.local.set({'image': $(`#sf_album${i} img`).attr('src')});
        // $(`#sf_body_bg`).css("background-image", "url("+$(`#sf_album${i} img`).attr('src')+")");
        
        chrome.extension.sendMessage({
            action: 'album_selection',
            data: $(`#sf_album${i} .sf_id`).html()
        });
    }
}

/**
 * Gets the user's playlists and fills the HTML select
 * @param {string} access_token the authenticated user's access token
 */
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
                $('#sf_playlists').append('<option value="' + xhr.items[i].id + '">' 
                + xhr.items[i].name + '</option>');
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

/**
 * Click listener for the 'back' button
 */
function backHandler() {
    $('#sf_back').click(() => {
        $('.sf_songs').remove();
        $('#sf_playlist_selector').remove();
        $('.sf_grid-container').show();
        $('#sf_back').remove();
    })
}

/**
 * Click listener for the 'x' button
 */
function closeHandler() {
    $('#sf_close').click(() => {
        closeOverlay();
    });
}

/**
 * Click listener for the 'select all' button
 */
function selectAllHandler() {
    $('#sf_sel_all').click(() => {
        $('.sf_track input').prop('checked', true);
    });
}

/**
 * Click listener for the 'select none' button
 */
function selectNoneHandler() {
    $('#sf_sel_none').click(() => {
        $('.sf_track input').prop('checked', false);
    });
}

/**
 * Click listener for the 'go' button.
 * Sends an array of track uris to the background script
 */
function goHandler() {
    $('#sf_go').click(() => {
        var track_data = [];
        $('.sf_songs input:checked').each((index, element) => {
            track_data.push(element.name);
        });
    
        chrome.extension.sendMessage({
            action: 'track_data',
            tracks: JSON.stringify(track_data),
            playlist: JSON.stringify({
                id: $('#sf_playlists').val(),
                name: $('#sf_playlists option:selected').text()
            })
        });
        
        closeOverlay();
    });
}

/**
 * Removes the entire Spotifind overlay
 */
function closeOverlay() {
    $('.sf_overlay').remove();
}