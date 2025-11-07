class SidePanel {
  constructor() {
    this.outlineData = [];
    this.currentPage = null;
    this.tabMonitorInterval = null;
    this.canAccessFiles = false;
    this.init();
  }

  destroy() {
    if (this.tabMonitorInterval) {
      clearInterval(this.tabMonitorInterval);
      this.tabMonitorInterval = null;
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    requestAnimationFrame(() => notification.classList.add('show'));

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  setActiveItem(element) {
    document.querySelectorAll('.outline-item.active').forEach(item => {
      item.classList.remove('active');
    });
    element.classList.add('active');
  }

  getFilenameFromUrl(url) {
    try {
      const path = url.replace(/^file:\/\//, '');
      const filename = path.includes('\\') ? path.split('\\').pop() : path.split('/').pop();
      return decodeURIComponent(filename || '本地文件');
    } catch (error) {
      return '本地文件';
    }
  }

  hasTabChanged(activeTab) {
    return activeTab && (!this.currentPage ||
      activeTab.id !== this.currentPage.id ||
      activeTab.url !== this.currentPage.url);
  }

  async checkFileAccess() {
    try {
      this.canAccessFiles = await chrome.runtime.isAllowedFileSchemeAccess();
    } catch (error) {
      console.log('Failed to check file access:', error);
      this.canAccessFiles = false;
    }
  }

  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentPage = tab;
      this.updatePageInfo(tab);
    } catch (error) {
      console.log('Failed to get current tab:', error);
      this.currentPage = null;
      this.updatePageInfoFallback();
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      sendResponse({ success: true });
    });
  }

  setupTabMonitoring() {
    this.tabMonitorInterval = setInterval(async () => {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (this.hasTabChanged(activeTab)) {
          this.currentPage = activeTab;
          this.updatePageInfo(activeTab);
          await this.generateOutline();
        }
      } catch (error) {
        console.log('Tab monitoring error:', error);
        this.currentPage = null;
        this.updatePageInfoFallback();
        this.renderError('无法获取页面信息');
      }
    }, 2000);
  }

  async ensureContentScript() {
    try {
      await chrome.tabs.sendMessage(this.currentPage.id, { action: 'ping' });
    } catch (error) {
      await chrome.scripting.executeScript({
        target: { tabId: this.currentPage.id },
        files: ['content.js']
      });
    }
  }

  async generateOutline() {
    if (!this.currentPage) return;

    this.renderLoading('正在分析页面...');

    try {
      await this.ensureContentScript();
      const response = await chrome.tabs.sendMessage(this.currentPage.id, {
        action: 'analyzePage'
      });

      if (response?.success) {
        this.outlineData = response.outline || [];
        this.renderOutline();
      } else {
        this.renderError(response?.error || '大纲生成失败');
      }
    } catch (error) {
      console.log('Generation failed:', error);
      this.renderError('大纲生成失败: ' + error.message);
    }
  }

  updatePageInfo(tab) {
    const pageInfo = document.getElementById('pageInfo');
    if (!pageInfo) return;

    if (tab?.url) {
      try {
        pageInfo.textContent = tab.url.startsWith('file://')
          ? this.getFilenameFromUrl(tab.url)
          : new URL(tab.url).hostname;
      } catch (error) {
        pageInfo.textContent = tab.title || '无效页面';
      }
    } else if (tab?.title) {
      pageInfo.textContent = tab.title;
    } else {
      pageInfo.textContent = '本地文件';
    }
  }

  updatePageInfoFallback() {
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) pageInfo.textContent = '页面信息获取失败';
  }

  renderOutline() {
    const container = document.getElementById('outlineContainer');

    if (!this.outlineData?.length) {
      this.renderEmpty();
      return;
    }

    container.innerHTML = this.outlineData.map(item => this.renderOutlineItem(item)).join('');
    this.attachClickHandlers();
  }

  renderOutlineItem(item) {
    return `<div class="outline-item level-${item.level}" data-id="${item.id}">
      <div class="outline-content">
        <div class="outline-title">${this.escapeHtml(item.title)}</div>
      </div>
    </div>`;
  }

  attachClickHandlers() {
    const container = document.getElementById('outlineContainer');
    container.querySelectorAll('.outline-item').forEach((element, index) => {
      element.addEventListener('click', () => this.handleItemClick(element, index));
    });
  }

  async handleItemClick(element, index) {
    this.setActiveItem(element);
    await this.navigateToItem(this.outlineData[index]);
  }

  async navigateToItem(item) {
    if (!this.currentPage) return;

    try {
      const response = await chrome.tabs.sendMessage(this.currentPage.id, {
        action: 'scrollToElement',
        itemData: item
      });

      this.showNotification(
        response?.success ? '已导航到章节' : '未找到该章节',
        response?.success ? 'success' : 'warning'
      );
    } catch (error) {
      console.log('Navigation failed:', error);
      this.showNotification('导航失败: ' + error.message, 'error');
    }
  }

  renderLoading(message = '加载中...') {
    const container = document.getElementById('outlineContainer');
    container.innerHTML = `<div class="loading">
      <div class="spinner"></div>
      <div>${message}</div>
    </div>`;
  }

  renderEmpty() {
    const container = document.getElementById('outlineContainer');
    container.innerHTML = `<div class="empty-state">
      <h3>暂无大纲</h3>
      <p>页面中没有找到标题元素。</p>
    </div>`;
  }

  renderError(message) {
    const container = document.getElementById('outlineContainer');
    container.innerHTML = `<div class="error">
      <strong>错误:</strong> ${message}
    </div>`;
  }

  async init() {
    try {
      await this.checkFileAccess();
      await this.getCurrentTab();
      this.setupMessageListener();
      this.setupTabMonitoring();
      await this.generateOutline();
    } catch (error) {
      console.log('Side panel initialization failed:', error);
      this.updatePageInfoFallback();
      this.renderError('初始化失败: ' + error.message);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new SidePanel());