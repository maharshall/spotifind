// Alexander Marshall

$('#auth').click(function() {
    chrome.extension.sendMessage({
        action: 'authorize'
    },
    function(response) {
        if(response.code == 1) {
            chrome.storage.local.get('access_token', function(result) {
                if(result.access_token) {
                    $('#status').html('Status: Authorized');
                } else {
                    $('#status').html('Status: Errored');
                }
            });
        } else {
            console.log('error during authentication');
            $('#status').html('Status: Errored');
        }
    });
})