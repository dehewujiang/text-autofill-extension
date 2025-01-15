document.addEventListener('DOMContentLoaded', function() {
  const shorthandInput = document.getElementById('shorthand');
  const textInput = document.getElementById('text');
  const saveButton = document.getElementById('save');
  const exportButton = document.getElementById('export');
  const importButton = document.getElementById('import');
  const fileInput = document.getElementById('fileInput');
  const searchInput = document.getElementById('search');
  const statusDiv = document.getElementById('status');
  const shortcutList = document.getElementById('shortcut-list');

  // 添加分类相关功能
  let currentCategory = '';
  let isListVisible = true;

  function updateCategoryFilter() {
    chrome.storage.local.get('shortcuts', function(result) {
      const shortcuts = result.shortcuts || {};
      const categories = new Set();
      
      Object.values(shortcuts).forEach(item => {
        if (item.category) categories.add(item.category);
      });

      const filterHtml = ['<button data-category="" class="active">全部</button>'];
      categories.forEach(category => {
        filterHtml.push(`<button data-category="${category}">${category}</button>`);
      });

      document.getElementById('categoryFilter').innerHTML = filterHtml.join('');
      addCategoryFilterListeners();
    });
  }

  function addCategoryFilterListeners() {
    document.querySelectorAll('#categoryFilter button').forEach(btn => {
      btn.addEventListener('click', function() {
        const category = this.dataset.category;
        
        if (category === '') { // 全部按钮
          if (this.classList.contains('active')) {
            toggleList();
          } else {
            isListVisible = true;
            document.querySelector('.shortcut-list').style.display = 'block';
          }
        }
        
        document.querySelectorAll('#categoryFilter button').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentCategory = category;
        updateShortcutList(searchInput.value);
      });
    });
  }

  // 导出功能
  function exportShortcuts() {
    setLoading(exportButton, true);
    chrome.storage.local.get('shortcuts', function(result) {
      const shortcuts = result.shortcuts || {};
      const blob = new Blob([JSON.stringify(shortcuts, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'text-autofill-shortcuts.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showStatus('导出成功！');
      setLoading(exportButton, false);
    });
  }

  // 添加进度条样式
  const style = document.createElement('style');
  style.textContent = `
    .progress-bar {
      width: 100%;
      height: 4px;
      background: #f1f3f4;
      border-radius: 2px;
      margin: 8px 0;
      display: none;
    }
    
    .progress-bar.show {
      display: block;
    }
    
    .progress-bar-inner {
      height: 100%;
      background: #1a73e8;
      border-radius: 2px;
      transition: width 0.3s;
    }
  `;
  document.head.appendChild(style);

  // 添加进度条HTML
  const progressBar = `
    <div class="progress-bar">
      <div class="progress-bar-inner" style="width: 0%"></div>
    </div>
  `;
  document.querySelector('.container').insertAdjacentHTML('afterbegin', progressBar);

  // 修改导入功能
  async function importShortcuts(file) {
    setLoading(importButton, true);
    const reader = new FileReader();
    
    reader.onload = async function(e) {
      try {
        const shortcuts = JSON.parse(e.target.result);
        
        // 使用 local storage 存储数据
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ shortcuts }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });

        updateShortcutList();
        showStatus('导入成功！');
      } catch (error) {
        console.error('Import error:', error);
        showStatus('导入失败：' + error.message);
      } finally {
        setLoading(importButton, false);
      }
    };

    reader.readAsText(file);
  }

  // 绑定导入导出按钮事件
  exportButton.addEventListener('click', exportShortcuts);
  importButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      importShortcuts(e.target.files[0]);
    }
  });

  // 修改保存功能
  function saveShortcut(shorthand, text) {
    chrome.storage.local.get('shortcuts', function(result) {
      const shortcuts = result.shortcuts || {};
      shortcuts[shorthand] = text;
      
      chrome.storage.local.set({ shortcuts }, function() {
        if (chrome.runtime.lastError) {
          showStatus('保存失败：' + chrome.runtime.lastError.message);
        } else {
          shorthandInput.value = '';
          textInput.value = '';
          updateShortcutList();
          showStatus('保存成功！');
        }
      });
    });
  }

  // 修改回车保存事件
  function handleEnterKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const shorthand = shorthandInput.value.trim();
      const text = textInput.value.trim();
      
      if (shorthand && text) {
        saveShortcut(shorthand, text);
        window.close();
      }
    }
  }

  // 修改保存功能
  saveButton.addEventListener('click', function() {
    const shorthand = shorthandInput.value.trim();
    const text = textInput.value.trim();
    const category = document.getElementById('category').value;
    
    if (shorthand && text) {
      chrome.storage.local.get('shortcuts', function(result) {
        const shortcuts = result.shortcuts || {};
        shortcuts[shorthand] = {
          text: text,
          category: category
        };
        
        chrome.storage.local.set({ shortcuts }, function() {
          shorthandInput.value = '';
          textInput.value = '';
          document.getElementById('category').value = '';
          updateShortcutList();
          updateCategoryFilter();
          showStatus('保存成功！');
        });
      });
    } else {
      showStatus('请输入简写和文本！');
    }
  });

  // 修改显示列表功能
  function updateShortcutList(filter = '') {
    if (!isListVisible) return;
    
    chrome.storage.local.get('shortcuts', (result) => {
      const shortcuts = result.shortcuts || {};
      
      const filteredShortcuts = Object.entries(shortcuts)
        .filter(([key, value]) => {
          const searchText = filter.toLowerCase();
          const matchesSearch = key.toLowerCase().includes(searchText);
          
          if (currentCategory) {
            return matchesSearch && value.category === currentCategory;
          }
          return matchesSearch;
        });
      
      const listHtml = filteredShortcuts.map(([key, value]) => `
        <div class="shortcut-item">
          <div>
            <span class="shortcut-key">/${key}</span>
            <span style="margin: 0 8px;">→</span>
            <span class="shortcut-text">${value.text || value}</span>
            ${value.category ? `<span class="category-tag">${value.category}</span>` : ''}
          </div>
          <span class="delete-btn" data-key="${key}">×</span>
        </div>
      `).join('');
      
      shortcutList.innerHTML = `
        <h3>快捷键列表 ${currentCategory ? `(${currentCategory})` : ''} (${filteredShortcuts.length})</h3>
        ${listHtml || '<div style="color: #5f6368; text-align: center; padding: 20px;">暂无快捷键</div>'}
      `;

      bindDeleteButtons();
    });
  }

  function showStatus(message, duration = 2000) {
    statusDiv.textContent = message;
    statusDiv.classList.add('show');
    setTimeout(() => {
      statusDiv.classList.remove('show');
    }, duration);
  }

  // 添加输入框聚焦效果
  [shorthandInput, textInput, searchInput].forEach(input => {
    input.addEventListener('focus', () => {
      input.style.backgroundColor = '#fff';
    });
    input.addEventListener('blur', () => {
      input.style.backgroundColor = '';
    });
  });

  // 添加按钮提示
  exportButton.setAttribute('data-tooltip', '导出配置到 JSON 文件');
  importButton.setAttribute('data-tooltip', '从 JSON 文件导入配置');

  // 初始化
  updateCategoryFilter();

  // 修改删除功能
  function deleteShortcut(key) {
    chrome.storage.local.get('shortcuts', function(result) {
      const shortcuts = result.shortcuts || {};
      delete shortcuts[key];
      
      chrome.storage.local.set({ shortcuts }, function() {
        updateShortcutList(searchInput.value || '');
        showStatus('删除成功');
      });
    });
  }

  // 修改删除按钮绑定
  function bindDeleteButtons() {
    const buttons = document.querySelectorAll('.delete-btn');
    buttons.forEach(btn => {
      // 移除旧的事件监听器
      btn.replaceWith(btn.cloneNode(true));
      
      // 添加新的事件监听器
      document.querySelector(`[data-key="${btn.dataset.key}"]`).addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        const key = this.dataset.key;
        deleteShortcut(key);
      }, { once: true });
    });
  }

  // 修改搜索功能
  searchInput.addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    updateShortcutList(searchTerm);
  });

  // 绑定回车事件
  shorthandInput.addEventListener('keypress', handleEnterKey);
  textInput.addEventListener('keypress', handleEnterKey);

  function toggleList() {
    isListVisible = !isListVisible;
    const listContent = document.querySelector('.shortcut-list');
    listContent.style.display = isListVisible ? 'block' : 'none';
  }
});

function setLoading(button, isLoading) {
  if (isLoading) {
    button.classList.add('loading');
  } else {
    button.classList.remove('loading');
  }
}

async function getAllShortcuts() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(null, (result) => {
      const shortcuts = {};
      const chunkCount = result.shortcutChunks || 0;
      
      for (let i = 0; i < chunkCount; i++) {
        const chunkData = result[`shortcuts_${i}`] || {};
        Object.assign(shortcuts, chunkData);
      }
      
      resolve(shortcuts);
    });
  });
}