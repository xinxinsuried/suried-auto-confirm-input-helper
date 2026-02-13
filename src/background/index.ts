// Background service worker
chrome.runtime.onInstalled.addListener(() => {
  // Extension installed
})

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'getTemplates') {
    chrome.storage.sync.get(['auto_confirm_templates'], (result) => {
      sendResponse(result.auto_confirm_templates || [])
    })
    return true
  }
})

// 监听标签页更新，通知content script
chrome.tabs.onUpdated.addListener((tabId, changeInfo, _tab) => {
  if (changeInfo.status === 'complete') {
    chrome.tabs.sendMessage(tabId, { action: 'pageLoaded' }).catch(() => {
      // 忽略错误（可能content script未加载）
    })
  }
})
