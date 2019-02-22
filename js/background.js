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
 * Displays a toast notification in the user's current tab
 * @param {string} message  the message to be displayed
 * @param {string} image    the image to be displayed (pass null for no image)
 */
function createToast(message, image) {
    chrome.tabs.query({currentWindow: true, active: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, 
        {
            action: 'toast',
            data: JSON.stringify({message: message, image: image})  
        });  
    });
}

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
    } else if(request.action === 'album_selection') {
        var album_id = request.data;
        chrome.storage.local.get('access_token', (result) => {
            getAllTracks(result.access_token, album_id);
        });
    } else if(request.action === 'track_data') {
        var tracks = JSON.parse(request.tracks);
        var playlist = JSON.parse(request.playlist);
        chrome.storage.local.get('access_token', (result) => {
            addMultipleToPlaylist(result.access_token, tracks, playlist);
        })
    }
    return true;
});

/**
 * Adds the selected track to the selected playlist
 * @param {string} access_token the authenticated user's access token
 * @param {string} track_uri    the uri of the track to be added to the playlist
 * @param {string} track_name   the name of the track to be added to the playlist
 * @param {bool}   notify       whether or not a notification should be shown
 */
function addToPlaylist(access_token, track_uri, track_name, image) {
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
                createToast(`Added track '${track_name}' to playlist '${results.playlist_name}'`, image);
            },
            error: function(xhr) {
                console.log(xhr.responseText);
                if(xhr.status === 401) {
                    alert('Your token has expired.\nPlease get a new one through the extension popup');
                }
            }
        });
    })
}

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
            createToast(`Added ${tracks.length} tracks to playlist '${playlist.name}'`, null);
        },
        error: function(xhr) {
            console.log(xhr.responseText);
            if(xhr.status === 401) {
                alert('Your token has expired.\nPlease get a new one through the extension popup');
            }
        }
    })
}

/**
 * Gets specific track of an album when using quick add
 * @param {string} access_token the authenticated user's access token
 * @param {string} album_id     the id of the desired album
 */
function getTrack(access_token, album_id, album_name, image) {
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
                if(xhr.items.length < 1) {
                    createToast(`Couldn't find track number ${track_number} on album '${album_name}'`, image);
                } else {
                    addToPlaylist(access_token, xhr.items[0].uri, xhr.items[0].name, image);
                }
            },
            error: function(xhr) {
                console.error(xhr.responseText);
                if(xhr.status === 401) {
                    alert('Your token has expired.\nPlease get a new one through the extension popup');
                }
            }
        });
    })
}

function getAllTracks(access_token, album_id) {
    $.ajax({
        url: 'https://api.spotify.com/v1/albums/'+album_id+'/tracks',
        headers: {
            'Authorization': 'Bearer ' + access_token
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
            if(xhr.status === 401) {
                alert('Your token has expired.\nPlease get a new one through the extension popup');
            }
        }
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
            if(xhr.albums.items.length < 1) {
                createToast(`No Reults for '${query}'`, null);
            } else {
                var album_id = xhr.albums.items[0].uri.replace('spotify:album:', '');
                var album_name = xhr.albums.items[0].name;
                var image = xhr.albums.items[0].images[0].url;
                getTrack(access_token, album_id, album_name, image);
            }
            
        },
        error: function(xhr) {
            console.error(xhr.responseText);
            if(xhr.status === 401) {
                alert('Your token has expired.\nPlease get a new one through the extension popup');
            }
        }
    });
}

/**
 * Find multiple albums on spotify based on user's query
 * @param {string} access_token the authenticated user's access token
 * @param {string} query        the string to search for
 */
function findAlbums(access_token, query) {
    $.ajax({
        url: 'https://api.spotify.com/v1/search',
        headers: {
            'Authorization': 'Bearer ' + access_token
        },
        data: {
            q: query,
            type: 'album',
            limit: 12
        },
        success: function(xhr) {
            if(xhr.albums.items.length < 1) {
                createToast(`No Reults for '${query}'`, null);
            } else {
                chrome.tabs.create({url: "detail.html"}, (tab) => {
                    chrome.tabs.executeScript(tab.id, {file: "js/jquery.min.js"}, () => {
                        chrome.tabs.executeScript(tab.id, {file: "js/detail.js"}, () => {
                            chrome.tabs.sendMessage(tab.id, 
                                {
                                    action: 'albums',
                                    data: JSON.stringify(xhr.albums.items)
                                },
                                (response) => {
                                    console.log(response.status);
                                });
                        });
                    });
                });
            }
            
        },
        error: function(xhr) {
            console.error(xhr.responseText);
            if(xhr.status === 401) {
                alert('Your token has expired.\nPlease get a new one through the extension popup');
            }
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
    chrome.storage.local.get(null, (results) => {
        if(results.quick_add) {
            findAlbum(results.access_token, query);
        } else {
            findAlbums(results.access_token, query);
        }
    });
});
