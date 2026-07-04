chrome.action.onClicked.addListener((tab) => {
  if (tab.url.includes("app.roll20.net/editor")) {
    chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "enhanced-vtt-token-gallery",
    title: "Galeria de Tokens (Enhanced VTT)",
    contexts: ["all"],
    documentUrlPatterns: ["*://app.roll20.net/editor/*"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "enhanced-vtt-token-gallery") {
    chrome.tabs.sendMessage(tab.id, { action: "openTokenGallery" });
  }
});
