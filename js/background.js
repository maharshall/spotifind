// Alexander Marshall

const redirect_uri = chrome.identity.getRedirectURL('oauth2');
const client_id = 'redacted';

/**
 * Generates a random string containing numbers and letters
 * @param {number} length   the length of the string
 * @returns {string}        the generated string 
 */
var generateRandomString = (length) => {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
}

/**
 * Create a notification for the user
 * @param {string} message the message to be displayed
 */
function createNotification(message) {
    chrome.notifications.create(
        {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icon.png'),
            title: 'Spotifind', 
            message: message
        }, () => {
            console.log(chrome.runtime.lastError.message);
        }
    );
}

// User has requested an access token
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if(request.action === 'authorize') {
        var state = generateRandomString(16);
        var scope = 'playlist-read-private playlist-read-collaborative '+
                    'playlist-modify-public playlist-modify-private';

        var params = $.param({
            client_id: client_id,
            response_type: 'token',
            redirect_uri: redirect_uri,
            scope: scope,
            state: state
        });

        var url = 'https://accounts.spotify.com/authorize?' + params;

       chrome.identity.launchWebAuthFlow({
            url: url,
            interactive: true
        }, (redirectURL) => {
            const params = new URLSearchParams(redirectURL.split('#')[1]);

            if(params.get('state') != state) {
                sendResponse({code: -1});
                throw new Error('invalid state');
            }

            const access_token = params.get('access_token');

            chrome.storage.local.set({'access_token': access_token});
            sendResponse({code: 1});
        })
    }
    return true;
});

/**
 * Adds the selected track to the selected playlist
 * @param {string} access_token the authenticated user's access token
 * @param {string} track_uri    the uri of the track to be added to the playlist
 * @param {string} track_name   the name of the track to be added to the playlist
 */
function addToPlaylist(access_token, track_uri, track_name, notify) {
    chrome.storage.local.get(null, (results) => {
        $.ajax({
            type: 'POST',
            url: 'https://api.spotify.com/v1/playlists/'+results.playlist_id+'/tracks?uris='+track_uri,
            headers: {
                'Authorization': 'Bearer ' + access_token,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            success: function(xhr) {
                var message = `added track '${track_name}' to playlist '${results.playlist_name}'`; 
                console.log(message);
                if(notify) createNotification(message);
            },
            error: function(xhr) {
                console.log(xhr.responseText);
            }
        });
    })
}

function addMultipleToPlaylist(access_token, track_uris, track_names) {

}

/**
 * Gets specific track of an album when using quick add
 * @param {string} access_token the authenticated user's access token
 * @param {string} album_id     the id of the desired album
 */
function getTrack(access_token, album_id) {
    chrome.storage.local.get('track_number', (result) => {
        var track_number = Number(result.track_number);
        $.ajax({
            url: 'https://api.spotify.com/v1/albums/'+album_id+'/tracks',
            headers: {
                'Authorization': 'Bearer ' + access_token
            },
            data: {
                limit: 1,
                offset: track_number-1
            },
            success: function(xhr) {
                var track_uri = xhr.items[0].uri;
                var track_name = xhr.items[0].name;
    
                addToPlaylist(access_token, track_uri, track_name, true);
            },
            error: function(xhr) {
                console.error(xhr.responseText);
            }
        });
    })
}

/**
 * Find an album on spotify based on user's query
 * @param {string} access_token the authenticated user's access token
 * @param {string} query        the string to search for
 */
function findAlbum(access_token, query) {
    $.ajax({
        url: 'https://api.spotify.com/v1/search',
        headers: {
            'Authorization': 'Bearer ' + access_token
        },
        data: {
            q: query,
            type: 'album',
            limit: 1
        },
        success: function(xhr) {
            var album_id = xhr.albums.items[0].uri.replace('spotify:album:', '');
            
            getTrack(access_token, album_id);
        },
        error: function(xhr) {
            console.error(xhr.responseText);
        }
    });
}

chrome.contextMenus.create({
    id: 'search',
    title: 'Spotifind \"%s\"',
    contexts: ["selection"]
});

chrome.contextMenus.onClicked.addListener((info) => {
    var query = info.selectionText;
    chrome.storage.local.get('access_token', (results) => {
        findAlbum(results.access_token, query);
    });
});
