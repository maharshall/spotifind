// Alexander Marshall

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
        if(!result.quick_add) toggleElements();
    });
})();

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
                    $('#track_number').val(9);
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

function toggleElements() {
    $('#p1').toggle();
    $('#p2').toggle();
    $('#track_number').toggle();
    $('#playlists').toggle();
}

$('#track_number').change(() => {
    chrome.storage.local.set({'track_number': $('#track_number').val()});
});

$('#playlists').change(() => {
    chrome.storage.local.set({'playlist_id': $('#playlists').val()});
    chrome.storage.local.set({'playlist_name': $("#playlists option:selected").text()})
});

$('#quick').click(() => {
    toggleElements();

    chrome.storage.local.set({'quick_add': $('#quick').prop('checked')});
});