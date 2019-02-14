// Alexander Marshall

chrome.runtime.onInstalled.addListener(function() {
    chrome.contextMenus.create({
        id: "search",
        title: "Search Spotify for \"%s\"",
        contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(clickHandler = function(info) {
    window.open('https://open.spotify.com/search/results/'+info.selectionText.toLowerCase(), '_blank');

});
