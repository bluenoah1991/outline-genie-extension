chrome.runtime.onInstalled.addListener(() => {
  console.log('OutlineGenie extension installed');
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.log('Failed to open side panel:', error);
  }
});