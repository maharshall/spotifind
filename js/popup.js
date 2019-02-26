// Alexander Marshall

// fill out HTML with the data from Chrome storage
(() => {
    chrome.storage.local.get(null, (result) => {
        if(result.access_token) {
            $('#status').html('Status: Authorized');
            $('#auth').toggle();
            getPlaylists(result.access_token);
        }
        $('#track_number').val(Number(result.track_number));
        $('#playlists').val(result.playlist_id);
        $('#quick').prop('checked', result.quick_add);
        if(!result.quick_add) $('.quickadd').hide();
    });
})();

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
                $('#playlists').append('<option value="' + 
                xhr.items[i].id + '">' + xhr.items[i].name + '</option>');
            }
            chrome.storage.local.get('playlist_id', (result) => {
                $('#playlists').val(result.playlist_id);
            })
        },
        error: function(xhr) {
            $('#status').html('Status: Token Expired');
            $('#auth').toggle();
        }
    })
}

/**
 * Click listener for the 'authorize' button
 * Sends message to backend and updates popup based on response
 */
$('#auth').click(() => {
    chrome.extension.sendMessage({
        action: 'authorize'
    },
    function(response) {
        if(response.code == 1) {
            chrome.storage.local.get('access_token', function(result) {
                if(result.access_token) {
                    $('#status').html('Status: Authorized');
                    $('#auth').toggle();
                    getPlaylists(result.access_token);
                } else {
                    $('#status').html('Status: No Token Provided');
                }
            });
        } else {
            console.error('error during authentication');
            $('#status').html('Status: Errored');
        }
    });
});

// listen for changes in the quick add track number and update chrome storage
$('#track_number').change(() => {
    chrome.storage.local.set({'track_number': $('#track_number').val()});
});

// listen for changes in playlist select and update chrome storage
$('#playlists').change(() => {
    chrome.storage.local.set({'playlist_id': $('#playlists').val()});
    chrome.storage.local.set({'playlist_name': $("#playlists option:selected").text()})
});

// hide/show HTML elements based on quick add checkbox
$('#quick').click(() => {
    $('.quickadd').toggle();

    chrome.storage.local.set({'quick_add': $('#quick').prop('checked')});
});