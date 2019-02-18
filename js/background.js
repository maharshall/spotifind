// Alexander Marshall

const redirect_uri = chrome.identity.getRedirectURL('oauth2');
const client_id = 'redacted';

/**
 * Generates a random string containing numbers and letters
 * @param {number} length   the length of the string
 * @returns {string}        the generated string 
 */
var generateRandomString = function(length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if(request.action === 'authorize') {
        var state = generateRandomString(16);
        var scope = 'playlist-read-private playlist-read-collaborative '+
                    'playlist-modify-public playlist-modify-private';

        var params = $.param({
            client_id: client_id,
            response_type: 'code',
            redirect_uri: redirect_uri,
            scope: scope,
            state: state
        });

        var url = 'https://accounts.spotify.com/authorize?' + params;

       chrome.identity.launchWebAuthFlow({
            url: url,
            interactive: true
        }, function(redirectURL) {
            const params = new URLSearchParams(redirectURL.split('?')[1]);

            if(params.get('state') != state) {
                sendResponse({code: -1});
                throw new Error('invalid state');
            }

            const access_token = params.get('code');

            chrome.storage.local.set({'access_token': access_token});
            sendResponse({code: 1});
        })
    }
    return true;
});

chrome.contextMenus.create({
    id: 'search',
    title: 'Spotifind \"%s\"',
    contexts: ["selection"]
});

chrome.contextMenus.onClicked.addListener(function(info) {

});
