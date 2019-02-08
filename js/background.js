chrome.runtime.onInstalled.addListener(function() {
    chrome.contextMenus.create({
        id: "search",
        title: "Search...",
        contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(clickHandler = function() {
    alert("I have been clicked");
});