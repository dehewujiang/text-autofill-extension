console.log('Content script loaded');

// 监听所有输入框的变化
function initializeInputListener() {
  document.addEventListener('input', handleInput, true);
}

function handleInput(event) {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || 
      event.target.contentEditable === 'true') {
    
    const input = event.target.value || event.target.textContent;
    
    if (input && input.startsWith('/')) {
      const shorthand = input.slice(1);
      
      chrome.storage.local.get('shortcuts', function(result) {
        const shortcuts = result.shortcuts || {};
        const shortcut = shortcuts[shorthand];
        
        if (shortcut) {
          // 获取实际文本内容
          const replacementText = typeof shortcut === 'object' ? shortcut.text : shortcut;
          
          if (event.target.contentEditable === 'true') {
            event.target.textContent = replacementText;
          } else {
            event.target.value = replacementText;
          }
          
          // 触发事件
          event.target.dispatchEvent(new Event('input', { bubbles: true }));
          event.target.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    }
  }
}

// 确保在页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeInputListener);
} else {
  initializeInputListener();
}

// 处理动态加载的内容
const observer = new MutationObserver(function(mutations) {
  mutations.forEach(function(mutation) {
    if (mutation.addedNodes.length) {
      initializeInputListener();
    }
  });
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});