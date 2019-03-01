// Alexander Marshall

const redirect_uri = chrome.identity.getRedirectURL('oauth2');
const client_id = 'redacted';
const debug = true;

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
 * Displays a toast notification in the user's current tab
 * @param {string} message  the message to be displayed
 * @param {string} image    the image to be displayed (pass null for no image)
 */
function createToast(message, image) {
    if(!image) image = chrome.extension.getURL('icons/128.png')
    chrome.tabs.query({currentWindow: true, active: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, 
        {
            action: 'toast',
            data: JSON.stringify({message: message, image: image})  
        });  
    });
}

// Handles messages from the popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // user has requested authorization
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

    // user has selected an album, get track information
    } else if(request.action === 'album_selection') {
        var album_id = request.data;
        chrome.storage.local.get('access_token', (result) => {
            getAlbumTracks(result.access_token, album_id);
        });

    // user has selected some tracks to add to a playlist
    } else if(request.action === 'track_data') {
        var tracks = JSON.parse(request.tracks);
        var playlist = JSON.parse(request.playlist);
        chrome.storage.local.get('access_token', (result) => {
            addMultipleToPlaylist(result.access_token, tracks, playlist);
        })

    // user has selected a track to add to a playlist
    } else if(request.action === 'track_uri') {
        chrome.storage.local.get('access_token', (result) => {
            addToPlaylist(result.access_token, request.track_uri, request.track_name, 
                        request.playlist_id, request.playlist_name, request.image);
        })
    }

    return true;
});

/**
 * Adds the selected track to the selected playlist
 * @param {string} access_token  the authenticated user's access token
 * @param {string} track_uri     the uri of the track to be added to the playlist
 * @param {string} track_name    the name of the track to be added to the playlist
 * @param {string} playlist_id   the id of the playlist to be added to
 * @param {string} playlist_name the name of the playlist to be added to
 * @param {string} image         the url of the image for the notification
 */
function addToPlaylist(access_token, track_uri, track_name, playlist_id, playlist_name, image) {
    $.ajax({
        type: 'POST',
        url: 'https://api.spotify.com/v1/playlists/'+playlist_id+'/tracks?uris='+track_uri,
        headers: {
            'Authorization': 'Bearer ' + access_token,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        success: function(xhr) {
            createToast(`Added '${track_name}' to playlist ${playlist_name}`, image);
        },
        error: function(xhr) {
            console.log(xhr.responseText);
            handleError(xhr);
        }
    });
}

/**
 * Adds multiple tracks to the selected playlist
 * @param {string} access_token     the authenticated user's access token
 * @param {array[object]} tracks    an array of track uris 
 * @param {object} playlist         an object containing the playlist id and name
 */
function addMultipleToPlaylist(access_token, tracks, playlist) {
    $.ajax({
        type: 'POST',
        url: 'https://api.spotify.com/v1/playlists/'+playlist.id+'/tracks?uris='+tracks.toString(),
        headers: {
            'Authorization': 'Bearer ' + access_token,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        success: function(xhr) {
            chrome.storage.local.get('image', (result) => {
                createToast(`Added ${tracks.length} track(s) to playlist ${playlist.name}`, result.image);
            });
        },
        error: function(xhr) {
            console.log(xhr.responseText);
            handleError(xhr);
        }
    })
}

/**
 * Gets all the tracks of the selected album
 * @param {string} access_token the authenticated user's access token
 * @param {string} album_id     the id of the album to get tracks from
 */
function getAlbumTracks(access_token, album_id) {
    $.ajax({
        url: 'https://api.spotify.com/v1/albums/'+album_id+'/tracks',
        headers: {
            'Authorization': 'Bearer ' + access_token
        },
        data: {
            limit: 50
        },
        success: function(xhr) {
            chrome.tabs.query({active: true}, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, 
                    {
                        action: 'track_data',
                        data: JSON.stringify(xhr.items)  
                    },
                    (response) => {
                        console.log(response);
                });
            });
        },
        error: function(xhr) {
            console.error(xhr.responseText);
            handleError(xhr);
        }
    })
}

/**
 * Find tracks on spotify based on user's query
 * @param {string} access_token the authenticated user's access token
 * @param {string} query        the string to search for
 */
function getTracks(access_token, query) {
    $.ajax({
        url: 'https://api.spotify.com/v1/search',
        headers: {
            'Authorization': 'Bearer ' + access_token
        },
        data: {
            q: query,
            type: 'track',
            limit: 50
        },
        success: function(xhr) {
            if(xhr.tracks.items.length < 1) {
                createToast(`No Reults for '${query}'`, null);
            } else {
                chrome.tabs.query({currentWindow: true, active: true}, (tabs) => {
                    chrome.tabs.sendMessage(tabs[0].id, 
                        {
                            action: 'tracks',
                            data: JSON.stringify(xhr.tracks.items)  
                        },
                        (response) => {
                            console.log(response);
                    });
                });
            }
            
        },
        error: function(xhr) {
            console.error(xhr.responseText);
            handleError(xhr);
        }
    });
}

/**
 * Find multiple albums on spotify based on user's query
 * @param {string} access_token the authenticated user's access token
 * @param {string} query        the string to search for
 */
function getAlbums(access_token, query) {
    $.ajax({
        url: 'https://api.spotify.com/v1/search',
        headers: {
            'Authorization': 'Bearer ' + access_token
        },
        data: {
            q: query,
            type: 'album',
            limit: 50
        },
        success: function(xhr) {
            if(xhr.albums.items.length < 1) {
                createToast(`No Reults for '${query}'`, null);
            } else {
                chrome.tabs.query({currentWindow: true, active: true}, (tabs) => {
                    chrome.tabs.sendMessage(tabs[0].id, 
                        {
                            action: 'albums',
                            data: JSON.stringify(xhr.albums.items)  
                        },
                        (response) => {
                            console.log(response);
                    });
                });
            }
            
        },
        error: function(xhr) {
            console.error(xhr.responseText);
            handleError(xhr);
        }
    });
}

/**
 * Handles errors from ajax requests
 * @param {object} error an object containing error information
 */
function handleError(error) {
    switch(error.status) {
        case 401:
            alert('Your token has expired.\nPlease get a new one through the extension popup');
            break;
        case 403:
            alert(error.responseJSON.error.message);
            break;
        case 500:
        case 502:
        case 503:
            alert('Something went wrong on the other end (Spotify). \nTry again later?');
            break;
        default:
            if(debug) alert(error.responseJSON.error.message);
            break;
    }
}

// creates the context menu entry
chrome.contextMenus.create({
    id: 'spotifind',
    title: 'Spotifind \"%s\"',
    contexts: ["selection"]
});

// Click listener for the context menu
chrome.contextMenus.onClicked.addListener((info) => {
    var query = info.selectionText;
    chrome.storage.local.get(null, (results) => {
        if(results.quick_add) {
            getTracks(results.access_token, query);
        } else {
            getAlbums(results.access_token, query);
        }
    });
});
