chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if(request.action === 'toast') {
        var data = JSON.parse(request.data);
        createToast(data.message, data.image);
    } else if(request.action === 'failure') {
        // create failures notification
    }
});

function createToast(message, image) {
    $('body').prepend('<div id="spotifind_toast"></div>');
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