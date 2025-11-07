if (!window.ContentAnalyzer) {
  class ContentAnalyzer {
    constructor() {
      this.outlineData = [];
      this.isAnalyzing = false;
      this.init();
    }

    init() {
      this.setupMessageListener();
      this.ensureHighlightStyle();
    }

    extractHeadings() {
      this.outlineData = [];
      const sourceDoc = this.getSourceDocument();
      const headings = sourceDoc.querySelectorAll('h1, h2, h3, h4, h5, h6');

      headings.forEach((heading, index) => {
        const text = heading.textContent?.trim();
        if (!text || text.length < 2) return;

        const id = heading.id || `outline-genie-${Date.now()}-${index}`;
        heading.id = id;

        const originalElement = sourceDoc === document ? heading :
          this.findOriginalElement(heading, text, id);

        this.outlineData.push({
          id,
          level: parseInt(heading.tagName.charAt(1)),
          title: text,
          element: originalElement
        });
      });

      this.adjustLevelJumps();
    }

    getSourceDocument() {
      try {
        const documentClone = document.cloneNode(true);
        const reader = new Readability(documentClone);
        const article = reader.parse();

        if (article?.content) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = article.content;
          console.log('Using Readability to extract main content');
          return tempDiv;
        }
      } catch (error) {
        console.log('Readability processing failed, using original document:', error.message);
      }
      return document;
    }

    findOriginalElement(heading, text, id) {
      const originalHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      for (let originalHeading of originalHeadings) {
        if (originalHeading.textContent.trim() === text) {
          originalHeading.id = id;
          return originalHeading;
        }
      }
      return heading;
    }

    adjustLevelJumps() {
      if (!this.outlineData.length) return;

      this.outlineData[0].level = 1;

      for (let i = 1; i < this.outlineData.length; i++) {
        const current = this.outlineData[i];
        const previous = this.outlineData[i - 1];

        if (current.level > previous.level + 1) {
          current.level = previous.level + 1;
        }
      }
    }

    async analyzePage() {
      if (this.isAnalyzing) {
        return { success: false, error: 'Analysis already in progress' };
      }

      try {
        this.isAnalyzing = true;
        console.log('Starting to extract headings...');
        this.extractHeadings();
        console.log('Number of headings found:', this.outlineData.length);

        return { success: true, outline: this.outlineData };
      } catch (error) {
        console.log('Error analyzing page:', error);
        return { success: false, error: error.message };
      } finally {
        this.isAnalyzing = false;
      }
    }

    async scrollToOutlineItem(itemData) {
      try {
        const targetElement = document.getElementById(itemData.id);
        if (!targetElement) {
          return { success: false, error: `Could not find element: ${itemData.id}` };
        }

        this.scrollToCenter(targetElement);
        this.highlightElement(targetElement);

        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    scrollToCenter(element) {
      const elementRect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const scrollTop = window.pageYOffset;
      const targetScrollTop = elementRect.top + scrollTop - (viewportHeight / 2) + (elementRect.height / 2);

      window.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    }

    highlightElement(element) {
      document.querySelectorAll('.outline-genie-highlighted').forEach(el => {
        el.classList.remove('outline-genie-highlighted');
      });

      element.classList.add('outline-genie-highlighted');
      setTimeout(() => element.classList.remove('outline-genie-highlighted'), 3000);
    }

    ensureHighlightStyle() {
      if (document.querySelector('#outline-genie-highlight-style')) return;

      const style = document.createElement('style');
      style.id = 'outline-genie-highlight-style';
      style.textContent = `
      .outline-genie-highlighted {
        background-color: rgba(59, 130, 246, 0.2) !important;
        border-radius: 4px !important;
        transition: background-color 2s ease;
      }
    `;
      document.head.appendChild(style);
    }

    setupMessageListener() {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        try {
          switch (request.action) {
            case 'ping':
              sendResponse({ success: true });
              break;
            case 'analyzePage':
              this.analyzePage().then(result => sendResponse(result));
              return true;
            case 'getOutline':
              sendResponse({ success: true, outline: this.outlineData });
              break;
            case 'scrollToElement':
              this.scrollToOutlineItem(request.itemData).then(result => sendResponse(result));
              return true;
            default:
              sendResponse({ success: false, error: 'Unknown action' });
          }
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        return true;
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.ContentAnalyzer = new ContentAnalyzer();
    });
  } else {
    window.ContentAnalyzer = new ContentAnalyzer();
  }
}