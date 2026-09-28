// Toolbar-button click toggles the AgentDemo UI in the active tab (all frames).
chrome.action.onClicked.addListener((tab) => {
  if (!tab || tab.id == null) return;
  chrome.tabs.sendMessage(tab.id, { type: "pn-toggle" }).catch(() => {});
});
