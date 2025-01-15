console.log('Background script loaded');

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ shortcuts: {} }, () => {
    console.log('Storage initialized');
  });
});