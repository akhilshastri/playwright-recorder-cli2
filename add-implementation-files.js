// add-implementation-files.js
// Run this AFTER create-playwright-recorder.js
// This includes FULL implementations of all files

const fs = require('fs');
const path = require('path');

console.log('📦 Adding FULL implementation files...\n');

const implementationFiles = {};

// ============================================================================
// CORE: aria-snapshot-generator.js - FULL IMPLEMENTATION
// ============================================================================
implementationFiles['src/core/aria-snapshot-generator.js'] = `const { detectComponent } = require('../components');

class AriaSnapshotGenerator {
  constructor(page) {
    this.page = page;
  }

  async generateSnapshot(selector, options = {}) {
    const includeComponentAttrs = options.includeComponentAttrs !== false;
    const includeRowData = options.includeRowData || false;
    const maxRows = options.maxRows || 3;

    const snapshot = await this.page.evaluate(
      ({ selector, includeComponentAttrs, includeRowData, maxRows }) => {
        const element = document.querySelector(selector);
        if (!element) {
          throw new Error(\`Element not found: \${selector}\`);
        }

        // Component detection functions
        const detectGrid = (el) => {
          return (
            el.id === 'grid' ||
            el.classList.contains('ag-grid') ||
            el.classList.contains('data-grid') ||
            el.getAttribute('role') === 'grid' ||
            el.hasAttribute('data-grid')
          );
        };

        const detectTable = (el) => {
          return (
            el.tagName === 'TABLE' ||
            el.getAttribute('role') === 'table' ||
            el.classList.contains('data-table')
          );
        };

        const detectDropdown = (el) => {
          return (
            el.getAttribute('role') === 'combobox' ||
            el.getAttribute('role') === 'listbox' ||
            el.classList.contains('dropdown') ||
            el.classList.contains('select') ||
            el.tagName === 'SELECT'
          );
        };

        const detectModal = (el) => {
          return (
            el.getAttribute('role') === 'dialog' ||
            el.getAttribute('role') === 'alertdialog' ||
            el.classList.contains('modal') ||
            el.classList.contains('dialog')
          );
        };

        const detectForm = (el) => {
          return (
            el.tagName === 'FORM' ||
            el.getAttribute('role') === 'form' ||
            el.classList.contains('form')
          );
        };

        const detectTabs = (el) => {
          return (
            el.getAttribute('role') === 'tablist' ||
            el.classList.contains('tabs') ||
            el.classList.contains('tab-list')
          );
        };

        const detectAccordion = (el) => {
          return (
            el.classList.contains('accordion') ||
            el.hasAttribute('data-accordion') ||
            (el.querySelector('[role="button"][aria-expanded]') && 
             el.querySelector('[role="region"]'))
          );
        };

        const detectPagination = (el) => {
          return (
            (el.getAttribute('role') === 'navigation' && 
             el.getAttribute('aria-label')?.toLowerCase().includes('pagination')) ||
            el.classList.contains('pagination') ||
            el.classList.contains('pager')
          );
        };

        const detectTree = (el) => {
          return (
            el.getAttribute('role') === 'tree' ||
            el.classList.contains('tree') ||
            el.classList.contains('tree-view')
          );
        };

        const getGridAttributes = (el) => {
          const attrs = {};
          
          const rows = el.querySelectorAll('[role="row"], .grid-row, .ag-row, tr');
          if (rows.length > 0) attrs['row-count'] = rows.length;

          const headerCells = el.querySelectorAll(
            '[role="columnheader"], .grid-header-cell, .ag-header-cell, thead th'
          );
          if (headerCells.length > 0) {
            attrs['column-count'] = headerCells.length;
            attrs['columns'] = Array.from(headerCells)
              .map(cell => cell.textContent.trim())
              .filter(Boolean);
          }

          const sortable = el.querySelector('[aria-sort], .sortable, .ag-header-cell-sortable');
          if (sortable) attrs['sortable'] = true;

          const filterable = el.querySelector('.filter, .ag-filter, [data-filter]');
          if (filterable) attrs['filterable'] = true;

          const selectable = el.querySelector('[aria-selected], .selected, .ag-row-selected');
          if (selectable) {
            attrs['selectable'] = true;
            const multiSelect = el.querySelector('input[type="checkbox"]');
            attrs['selection-mode'] = multiSelect ? 'multiple' : 'single';
          }

          const pagination = el.querySelector('.pagination, .ag-paging-panel');
          if (pagination) {
            attrs['paginated'] = true;
            const pageInfo = pagination.textContent.match(/(\\d+)\\s*of\\s*(\\d+)/);
            if (pageInfo) {
              attrs['current-page'] = parseInt(pageInfo[1]);
              attrs['total-pages'] = parseInt(pageInfo[2]);
            }
          }

          return attrs;
        };

        const getTableAttributes = (el) => {
          const attrs = {};
          
          const rows = el.querySelectorAll('tr, [role="row"]');
          const headerRow = el.querySelector('thead tr, [role="rowgroup"]:first-child [role="row"]');
          
          if (rows.length > 0) {
            attrs['row-count'] = rows.length - (headerRow ? 1 : 0);
          }

          if (headerRow) {
            const headers = headerRow.querySelectorAll('th, [role="columnheader"]');
            attrs['column-count'] = headers.length;
            attrs['headers'] = Array.from(headers).map(h => h.textContent.trim());
          }

          if (el.classList.contains('responsive-table')) {
            attrs['responsive'] = true;
          }

          const striped = el.querySelector('.striped, tbody tr:nth-child(even)[class*="alt"]');
          if (striped) attrs['striped'] = true;

          return attrs;
        };

        const getDropdownAttributes = (el) => {
          const attrs = {};

          const multiSelect = el.hasAttribute('multiple') ||
                             el.getAttribute('aria-multiselectable') === 'true';
          if (multiSelect) attrs['multi-select'] = true;

          const searchable = el.querySelector('input[type="search"], input[type="text"]');
          if (searchable) attrs['searchable'] = true;

          const optionElements = el.querySelectorAll('option, [role="option"]');
          const options = Array.from(optionElements)
            .map(opt => opt.textContent.trim())
            .filter(Boolean);

          if (options.length > 0) {
            attrs['option-count'] = options.length;
            if (options.length <= 5) {
              attrs['options'] = options;
            }
          }

          if (el.tagName === 'SELECT') {
            const selected = el.querySelectorAll('option:checked');
            if (selected.length > 0) {
              const values = Array.from(selected).map(opt => opt.textContent.trim());
              attrs['selected'] = multiSelect ? values : values[0];
            }
          }

          const placeholder = el.getAttribute('placeholder');
          if (placeholder) attrs['placeholder'] = placeholder.trim();

          return attrs;
        };

        const getModalAttributes = (el) => {
          const attrs = {};

          const sizeClasses = ['small', 'medium', 'large', 'xl', 'fullscreen'];
          for (const size of sizeClasses) {
            if (el.classList.contains(size) || el.classList.contains(\`modal-\${size}\`)) {
              attrs['size'] = size;
              break;
            }
          }

          const title = el.querySelector('[role="heading"], .modal-title, h1, h2, h3');
          if (title) attrs['title'] = title.textContent.trim();

          const closeButton = el.querySelector('.close, .modal-close, [data-dismiss]');
          if (closeButton) attrs['closeable'] = true;

          const backdrop = document.querySelector('.modal-backdrop, .overlay');
          if (backdrop) {
            attrs['has-backdrop'] = true;
          }

          const footer = el.querySelector('.modal-footer, .dialog-footer');
          if (footer) {
            const buttons = footer.querySelectorAll('button');
            if (buttons.length > 0) {
              attrs['footer-actions'] = Array.from(buttons)
                .map(btn => btn.textContent.trim())
                .filter(Boolean);
            }
          }

          const isOpen = el.classList.contains('show') ||
                        el.classList.contains('open') ||
                        el.getAttribute('aria-hidden') === 'false';
          attrs['open'] = isOpen;

          return attrs;
        };

        const getFormAttributes = (el) => {
          const attrs = {};

          const name = el.getAttribute('name') || el.getAttribute('id');
          if (name) attrs['name'] = name;

          const method = el.getAttribute('method');
          if (method) attrs['method'] = method.toUpperCase();

          const inputs = el.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), select, textarea');
          attrs['field-count'] = inputs.length;

          if (inputs.length > 0) {
            const fieldTypes = {};
            inputs.forEach(input => {
              const type = input.type || input.tagName.toLowerCase();
              fieldTypes[type] = (fieldTypes[type] || 0) + 1;
            });
            attrs['field-types'] = fieldTypes;
          }

          const hasValidation = el.querySelector('[required], [pattern]');
          if (hasValidation) attrs['validation'] = true;

          const submitButton = el.querySelector('button[type="submit"], input[type="submit"]');
          if (submitButton) {
            attrs['submit-button'] = submitButton.textContent.trim() || submitButton.value || 'Submit';
          }

          const errors = el.querySelectorAll('.error, .invalid, [aria-invalid="true"]');
          if (errors.length > 0) {
            attrs['has-errors'] = true;
            attrs['error-count'] = errors.length;
          }

          return attrs;
        };

        const getTabsAttributes = (el) => {
          const attrs = {};

          const tabElements = el.querySelectorAll('[role="tab"], .tab');
          const tabs = Array.from(tabElements).map(tabEl => {
            const label = tabEl.textContent.trim();
            const active = tabEl.getAttribute('aria-selected') === 'true' ||
                          tabEl.classList.contains('active');
            return { label, active };
          });

          if (tabs.length > 0) {
            attrs['tab-count'] = tabs.length;
            attrs['tabs'] = tabs.map(t => t.label);

            const activeTab = tabs.find(t => t.active);
            if (activeTab) {
              attrs['active-tab'] = activeTab.label;
            }
          }

          return attrs;
        };

        const getAccordionAttributes = (el) => {
          const attrs = {};

          const itemElements = el.querySelectorAll('.accordion-item, [data-accordion-item]');
          const items = [];
          
          itemElements.forEach(itemEl => {
            const button = itemEl.querySelector('[role="button"], button');
            if (button) {
              const label = button.textContent.trim();
              const expanded = button.getAttribute('aria-expanded') === 'true';
              items.push({ label, expanded });
            }
          });

          if (items.length > 0) {
            attrs['item-count'] = items.length;
            attrs['items'] = items;
            const expandedCount = items.filter(item => item.expanded).length;
            attrs['expanded-count'] = expandedCount;
          }

          return attrs;
        };

        const getPaginationAttributes = (el) => {
          const attrs = {};

          const active = el.querySelector('[aria-current="page"], .active');
          if (active) {
            const pageNum = parseInt(active.textContent.trim());
            if (!isNaN(pageNum)) attrs['current-page'] = pageNum;
          }

          const pageLinks = el.querySelectorAll('a, button');
          let maxPage = 0;
          pageLinks.forEach(link => {
            const pageNum = parseInt(link.textContent.trim());
            if (!isNaN(pageNum) && pageNum > maxPage) maxPage = pageNum;
          });
          if (maxPage > 0) attrs['total-pages'] = maxPage;

          const prevButton = el.querySelector('[aria-label*="previous" i], .prev');
          const nextButton = el.querySelector('[aria-label*="next" i], .next');
          
          if (prevButton) {
            attrs['has-prev'] = !prevButton.hasAttribute('disabled');
          }
          if (nextButton) {
            attrs['has-next'] = !nextButton.hasAttribute('disabled');
          }

          return attrs;
        };

        const getTreeAttributes = (el) => {
          const attrs = {};

          const itemElements = el.querySelectorAll('[role="treeitem"]');
          const items = [];
          
          itemElements.forEach(itemEl => {
            const label = itemEl.textContent.trim();
            const expanded = itemEl.getAttribute('aria-expanded') === 'true';
            const selected = itemEl.getAttribute('aria-selected') === 'true';
            items.push({ label, expanded, selected });
          });

          if (items.length > 0) {
            attrs['item-count'] = items.length;
            const expanded = items.filter(item => item.expanded).length;
            if (expanded > 0) attrs['expanded-count'] = expanded;
          }

          return attrs;
        };

        const getRowData = (el, limit) => {
          const rows = el.querySelectorAll('[role="row"], .grid-row, tbody tr');
          const data = [];

          for (let i = 0; i < Math.min(limit, rows.length); i++) {
            const cells = rows[i].querySelectorAll('[role="gridcell"], .grid-cell, td');
            const rowData = Array.from(cells).map(cell => cell.textContent.trim());
            if (rowData.length > 0) data.push(rowData);
          }

          return data;
        };

        let componentType = null;
        let customAttrs = {};

        if (includeComponentAttrs) {
          if (detectGrid(element)) {
            componentType = 'grid';
            customAttrs = getGridAttributes(element);
          } else if (detectTable(element)) {
            componentType = 'table';
            customAttrs = getTableAttributes(element);
          } else if (detectDropdown(element)) {
            componentType = 'combobox';
            customAttrs = getDropdownAttributes(element);
          } else if (detectModal(element)) {
            componentType = 'dialog';
            customAttrs = getModalAttributes(element);
          } else if (detectForm(element)) {
            componentType = 'form';
            customAttrs = getFormAttributes(element);
          } else if (detectTabs(element)) {
            componentType = 'tablist';
            customAttrs = getTabsAttributes(element);
          } else if (detectAccordion(element)) {
            componentType = 'accordion';
            customAttrs = getAccordionAttributes(element);
          } else if (detectPagination(element)) {
            componentType = 'navigation';
            customAttrs = getPaginationAttributes(element);
          } else if (detectTree(element)) {
            componentType = 'tree';
            customAttrs = getTreeAttributes(element);
          }
        }

        let rowData = null;
        if (includeRowData && (componentType === 'grid' || componentType === 'table')) {
          rowData = getRowData(element, maxRows);
        }

        const role = componentType || 
                    element.getAttribute('role') || 
                    element.tagName.toLowerCase();
        const name = element.getAttribute('aria-label') || 
                     element.getAttribute('id') ||
                     '';

        return {
          role,
          name,
          selector,
          customAttrs,
          rowData,
        };
      },
      { selector, includeComponentAttrs, includeRowData, maxRows }
    );

    return this.formatSnapshot(snapshot, options);
  }

  formatSnapshot(snapshot, options = {}) {
    const lines = [];
    const indent = '  ';

    let line = \`- \${snapshot.role}\`;
    if (snapshot.name) {
      line += \` "\${snapshot.name}"\`;
    }

    if (snapshot.customAttrs && Object.keys(snapshot.customAttrs).length > 0) {
      const attrs = [];
      
      for (const [key, value] of Object.entries(snapshot.customAttrs)) {
        if (Array.isArray(value)) {
          attrs.push(\`\${key}=[\${value.map(v => \`"\${v}"\`).join(', ')}]\`);
        } else if (typeof value === 'object') {
          attrs.push(\`\${key}=\${JSON.stringify(value)}\`);
        } else if (typeof value === 'string') {
          attrs.push(\`\${key}="\${value}"\`);
        } else {
          attrs.push(\`\${key}=\${value}\`);
        }
      }
      
      if (attrs.length > 0) {
        line += \` [\${attrs.join(' ')}]\`;
      }
    }

    lines.push(line);

    if (snapshot.rowData && snapshot.rowData.length > 0) {
      lines.push(\`\${indent}# Sample rows:\`);
      snapshot.rowData.forEach((row, idx) => {
        const rowStr = row.map(cell => \`"\${cell}"\`).join(', ');
        lines.push(\`\${indent}# Row \${idx + 1}: [\${rowStr}]\`);
      });
    }

    return lines.join('\\n');
  }

  async generateEnhancedSnapshot(selector, options = {}) {
    try {
      const locator = this.page.locator(selector);
      let playwrightSnapshot = null;
      
      try {
        playwrightSnapshot = await locator.ariaSnapshot();
      } catch (e) {
        // Native method not available
      }

      const customSnapshot = await this.generateSnapshot(selector, {
        includeComponentAttrs: true,
        includeRowData: options.includeRowData,
        maxRows: options.maxRows,
      });

      return customSnapshot || playwrightSnapshot || '- fragment';

    } catch (error) {
      console.warn('Snapshot generation failed:', error.message);
      return this.generateSnapshot(selector, options);
    }
  }
}

module.exports = { AriaSnapshotGenerator };
`;

// ============================================================================
// CORE: recorder-injector.js - FULL IMPLEMENTATION
// ============================================================================
implementationFiles['src/core/recorder-injector.js'] = `const { chromium } = require('playwright');
const { AriaSnapshotGenerator } = require('./aria-snapshot-generator');
const { JavaScriptCodeGenerator } = require('./code-generator');

class CustomRecorder {
  constructor(options = {}) {
    this.options = options;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.actions = [];
    this.snapshots = new Map();
    this.codeGenerator = new JavaScriptCodeGenerator(options);
    this.currentUrl = null;
  }

  async start(url) {
    this.browser = await chromium.launch({
      headless: false,
      args: ['--start-maximized'],
    });

    this.context = await this.browser.newContext({
      viewport: null,
    });

    this.page = await this.context.newPage();
    this.snapshotGenerator = new AriaSnapshotGenerator(this.page);

    this.page.on('framenavigated', (frame) => {
      if (frame === this.page.mainFrame()) {
        this.currentUrl = frame.url();
        this.codeGenerator.addAction({
          type: 'goto',
          url: this.currentUrl,
        });
      }
    });

    if (url) {
      await this.page.goto(url);
      this.currentUrl = url;
    }

    await this.injectRecorderUI();
    await this.setupActionListeners();
    await this.waitForRecordingComplete();
  }

  async setupActionListeners() {
    await this.page.exposeFunction('recordAction', (action) => {
      this.codeGenerator.addAction(action);
      this.updateCodePreview();
    });

    await this.page.evaluate(() => {
      document.addEventListener('click', (e) => {
        if (e.target.closest('#custom-recorder-ui')) return;
        
        const selector = window.__generateSelector(e.target);
        window.recordAction({
          type: 'click',
          selector,
          timestamp: Date.now(),
        });
      }, true);

      document.addEventListener('input', (e) => {
        if (e.target.closest('#custom-recorder-ui')) return;
        
        const selector = window.__generateSelector(e.target);
        window.recordAction({
          type: 'fill',
          selector,
          value: e.target.value,
          timestamp: Date.now(),
        });
      }, true);

      window.__generateSelector = (element) => {
        if (element.id) return \`#\${element.id}\`;
        if (element.name) return \`[name="\${element.name}"]\`;
        
        const testId = element.getAttribute('data-testid');
        if (testId) return \`[data-testid="\${testId}"]\`;
        
        if (element.className && typeof element.className === 'string') {
          const classes = element.className.split(' ').filter(Boolean);
          if (classes.length > 0) return \`.\${classes[0]}\`;
        }
        
        return element.tagName.toLowerCase();
      };
    });
  }

  async injectRecorderUI() {
    await this.page.evaluate(() => {
      const recorderUI = document.createElement('div');
      recorderUI.id = 'custom-recorder-ui';
      recorderUI.innerHTML = \`
        <style>
          #custom-recorder-ui {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 999999;
            background: #1e1e1e;
            color: #fff;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: 'Courier New', monospace;
            min-width: 350px;
            max-width: 500px;
            max-height: 80vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          #custom-recorder-ui h3 {
            margin: 0 0 10px 0;
            font-size: 14px;
            color: #4fc3f7;
          }
          #custom-recorder-ui .buttons {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
            margin-bottom: 10px;
          }
          #custom-recorder-ui button {
            background: #2196f3;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            flex: 1;
            min-width: 100px;
          }
          #custom-recorder-ui button:hover {
            background: #1976d2;
          }
          #custom-recorder-ui button.danger {
            background: #f44336;
          }
          #custom-recorder-ui button.success {
            background: #4caf50;
          }
          #custom-recorder-ui .status {
            margin: 10px 0;
            padding: 8px;
            background: #263238;
            border-radius: 4px;
            font-size: 10px;
            max-height: 100px;
            overflow-y: auto;
          }
          #custom-recorder-ui .code-preview {
            margin-top: 10px;
            padding: 10px;
            background: #263238;
            border-radius: 4px;
            font-size: 10px;
            max-height: 300px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            white-space: pre-wrap;
            flex: 1;
          }
          .recorder-highlight {
            outline: 2px solid #4fc3f7 !important;
            outline-offset: 2px;
            cursor: crosshair !important;
          }
        </style>
        <h3>🎬 Playwright Recorder</h3>
        <div class="buttons">
          <button id="capture-snapshot-btn">📸 Snapshot</button>
          <button id="capture-component-btn">🎯 Component</button>
          <button class="success" id="save-test-btn">💾 Save Test</button>
          <button class="danger" id="stop-recording-btn">⏹️ Stop</button>
        </div>
        <div class="status" id="recorder-status">
          ✅ Recording... Interact with the page
        </div>
        <div class="code-preview" id="code-preview">
          // Generated code will appear here...
        </div>
      \`;
      document.body.appendChild(recorderUI);

      window.__recorderState = {
        capturing: false,
        captureType: null,
      };
    });

    await this.page.exposeFunction('captureSnapshot', async (selector) => {
      return await this.captureAriaSnapshot(selector, { includeRowData: false });
    });

    await this.page.exposeFunction('captureComponent', async (selector) => {
      return await this.captureAriaSnapshot(selector, { 
        includeRowData: true,
        maxRows: 3 
      });
    });

    await this.page.exposeFunction('saveTestFile', async () => {
      return await this.saveTest();
    });

    await this.page.exposeFunction('stopRecording', async () => {
      return await this.stop();
    });

    await this.page.evaluate(() => {
      document.getElementById('capture-snapshot-btn').addEventListener('click', () => {
        window.__recorderState.capturing = true;
        window.__recorderState.captureType = 'snapshot';
        document.getElementById('recorder-status').textContent = '👆 Click element to capture aria snapshot...';
      });

      document.getElementById('capture-component-btn').addEventListener('click', () => {
        window.__recorderState.capturing = true;
        window.__recorderState.captureType = 'component';
        document.getElementById('recorder-status').textContent = '👆 Click component to capture...';
      });

      document.getElementById('save-test-btn').addEventListener('click', async () => {
        document.getElementById('recorder-status').textContent = '💾 Saving test...';
        const result = await window.saveTestFile();
        document.getElementById('recorder-status').textContent = \`✅ Saved: \${result}\`;
      });

      document.getElementById('stop-recording-btn').addEventListener('click', async () => {
        await window.stopRecording();
        window.close();
      });

      document.addEventListener('mouseover', (e) => {
        if (window.__recorderState.capturing && !e.target.closest('#custom-recorder-ui')) {
          e.target.classList.add('recorder-highlight');
        }
      });

      document.addEventListener('mouseout', (e) => {
        if (window.__recorderState.capturing) {
          e.target.classList.remove('recorder-highlight');
        }
      });

      document.addEventListener('click', async (e) => {
        if (!window.__recorderState.capturing) return;
        if (e.target.closest('#custom-recorder-ui')) return;

        e.preventDefault();
        e.stopPropagation();

        const target = e.target;
        target.classList.remove('recorder-highlight');

        const selector = window.__generateSelector(target);
        document.getElementById('recorder-status').textContent = '⏳ Generating snapshot...';

        try {
          let snapshot;
          if (window.__recorderState.captureType === 'component') {
            snapshot = await window.captureComponent(selector);
          } else {
            snapshot = await window.captureSnapshot(selector);
          }

          document.getElementById('recorder-status').innerHTML = \`✅ Captured \${selector}!\`;
          
          setTimeout(() => {
            document.getElementById('recorder-status').textContent = '✅ Recording... Interact with the page';
          }, 2000);
        } catch (error) {
          document.getElementById('recorder-status').textContent = \`❌ Error: \${error.message}\`;
        }

        window.__recorderState.capturing = false;
      }, true);
    });
  }

  async captureAriaSnapshot(selector, options) {
    const snapshot = await this.snapshotGenerator.generateEnhancedSnapshot(
      selector,
      options
    );

    this.snapshots.set(selector, snapshot);
    this.codeGenerator.addComponentSnapshot(selector, snapshot, options);
    
    await this.updateCodePreview();
    
    return snapshot;
  }

  async updateCodePreview() {
    const code = this.codeGenerator.generateTest('recorded test', this.currentUrl);
    
    await this.page.evaluate((code) => {
      const preview = document.getElementById('code-preview');
      if (preview) {
        preview.textContent = code;
      }
    }, code);
  }

  async saveTest() {
    const outputPath = this.options.output || './tests/recorded.spec.js';
    const filePath = await this.codeGenerator.saveToFile(outputPath);
    return filePath;
  }

  async waitForRecordingComplete() {
    return new Promise((resolve) => {
      this.page.on('close', resolve);
    });
  }

  async stop() {
    if (this.codeGenerator.actions.length > 0 || this.snapshots.size > 0) {
      await this.saveTest();
    }
    
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = { CustomRecorder };
`;

// ============================================================================
// CORE: code-generator.js - FULL IMPLEMENTATION
// ============================================================================
implementationFiles['src/core/code-generator.js'] = `class JavaScriptCodeGenerator {
  constructor(options = {}) {
    this.actions = [];
    this.snapshots = new Map();
    this.imports = new Set(['test', 'expect']);
  }

  addAction(action) {
    this.actions.push(action);
  }

  addComponentSnapshot(selector, snapshot, options = {}) {
    this.snapshots.set(selector, {
      snapshot,
      options,
      timestamp: Date.now(),
    });
    
    this.imports.add('toMatchComponentSnapshot');
  }

  generateTest(testName = 'test', url = null) {
    const lines = [];

    lines.push(this.generateImports());
    lines.push('');

    lines.push(\`test('\${testName}', async ({ page }) => {\`);

    if (url) {
      lines.push(\`  await page.goto('\${url}');\`);
      lines.push('');
    }

    this.actions.forEach(action => {
      const code = this.generateActionCode(action);
      if (code) {
        lines.push(\`  \${code}\`);
      }
    });

    if (this.snapshots.size > 0) {
      lines.push('');
      lines.push('  // Component snapshot assertions');
      
      for (const [selector, data] of this.snapshots.entries()) {
        lines.push(this.generateSnapshotAssertion(selector, data));
      }
    }

    lines.push('});');
    lines.push('');

    return lines.join('\\n');
  }

  generateImports() {
    const lines = [];
    
    lines.push("const { test, expect } = require('@playwright/test');");
    
    if (this.imports.has('toMatchComponentSnapshot')) {
      lines.push("const { expect: expectWithComponents } = require('./helpers/custom-matchers');");
    }

    return lines.join('\\n');
  }

  generateActionCode(action) {
    switch (action.type) {
      case 'goto':
        return \`await page.goto('\${action.url}');\`;
      
      case 'click':
        return \`await page.click('\${action.selector}');\`;
      
      case 'fill':
        return \`await page.fill('\${action.selector}', '\${action.value}');\`;
      
      case 'select':
        return \`await page.selectOption('\${action.selector}', '\${action.value}');\`;
      
      case 'press':
        return \`await page.press('\${action.selector}', '\${action.key}');\`;
      
      case 'check':
        return \`await page.check('\${action.selector}');\`;
      
      case 'uncheck':
        return \`await page.uncheck('\${action.selector}');\`;
      
      default:
        return null;
    }
  }

  generateSnapshotAssertion(selector, data) {
    const lines = [];
    const indent = '  ';
    
    const snapshotLines = data.snapshot.trim().split('\\n');
    const formattedSnapshot = snapshotLines
      .map((line, idx) => {
        if (idx === 0) return line;
        return '    ' + line;
      })
      .join('\\n');

    lines.push(\`\${indent}await expect(page.locator('\${selector}')).toMatchComponentSnapshot(\\\`\`);
    lines.push(\`\${indent}  \${formattedSnapshot}\`);
    lines.push(\`\${indent}\\\`);\`);

    return lines.join('\\n');
  }

  async saveToFile(filePath) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const code = this.generateTest();
    
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    await fs.writeFile(filePath, code, 'utf-8');
    
    return filePath;
  }
}

module.exports = { JavaScriptCodeGenerator };
`;

// ============================================================================
// CORE: snapshot-updater.js - FULL IMPLEMENTATION
// ============================================================================
implementationFiles['src/core/snapshot-updater.js'] = `const fs = require('fs').promises;
const path = require('path');
const { chromium } = require('playwright');
const { AriaSnapshotGenerator } = require('./aria-snapshot-generator');
const { createTwoFilesPatch } = require('diff');

class SnapshotUpdater {
  constructor(options = {}) {
    this.options = options;
    this.browser = null;
    this.context = null;
  }

  async init() {
    this.browser = await chromium.launch({
      headless: this.options.headless !== false,
    });
    this.context = await this.browser.newContext();
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async updateSnapshots(snapshots) {
    await this.init();

    const results = {
      total: snapshots.length,
      updated: 0,
      skipped: 0,
      failed: 0,
      patchFiles: [],
    };

    try {
      for (const snapshot of snapshots) {
        try {
          const result = await this.updateSnapshot(snapshot);
          
          if (result.updated) {
            results.updated++;
            if (result.patchFile) {
              results.patchFiles.push(result.patchFile);
            }
          } else {
            results.skipped++;
          }
        } catch (error) {
          console.error(\`Failed to update \${snapshot.selector}: \${error.message}\`);
          results.failed++;
        }
      }
    } finally {
      await this.close();
    }

    return results;
  }

  async updateSnapshot(snapshotInfo) {
    const page = await this.context.newPage();
    
    try {
      const url = this.options.baseUrl || 'http://localhost:3000';
      await page.goto(url, { waitUntil: 'networkidle' });

      const generator = new AriaSnapshotGenerator(page);
      const newSnapshot = await generator.generateEnhancedSnapshot(
        snapshotInfo.selector,
        {
          includeComponentAttrs: true,
          includeRowData: false,
        }
      );

      if (snapshotInfo.snapshot === newSnapshot) {
        return { updated: false, reason: 'unchanged' };
      }

      if (this.options.updateSourceMethod === 'overwrite') {
        await this.overwriteSnapshot(snapshotInfo, newSnapshot);
      } else if (this.options.updateSourceMethod === '3way') {
        await this.threeWayMerge(snapshotInfo, newSnapshot);
      } else {
        const patchFile = await this.createPatch(snapshotInfo, newSnapshot);
        return { updated: true, patchFile };
      }

      return { updated: true };

    } finally {
      await page.close();
    }
  }

  async overwriteSnapshot(snapshotInfo, newSnapshot) {
    const content = await fs.readFile(snapshotInfo.file, 'utf-8');
    
    const escaped = snapshotInfo.snapshot.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
    const regex = new RegExp(escaped, 'g');
    const updated = content.replace(regex, newSnapshot);

    await fs.writeFile(snapshotInfo.file, updated, 'utf-8');
  }

  async threeWayMerge(snapshotInfo, newSnapshot) {
    const content = await fs.readFile(snapshotInfo.file, 'utf-8');
    
    const mergeMarker = \`<<<<<<< HEAD (current)
\${snapshotInfo.snapshot}
=======
\${newSnapshot}
>>>>>>> Updated snapshot\`;

    const escaped = snapshotInfo.snapshot.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
    const regex = new RegExp(escaped, 'g');
    const updated = content.replace(regex, mergeMarker);

    await fs.writeFile(snapshotInfo.file, updated, 'utf-8');
  }

  async createPatch(snapshotInfo, newSnapshot) {
    const oldContent = await fs.readFile(snapshotInfo.file, 'utf-8');
    
    const escaped = snapshotInfo.snapshot.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
    const regex = new RegExp(escaped, 'g');
    const newContent = oldContent.replace(regex, newSnapshot);

    const patch = createTwoFilesPatch(
      snapshotInfo.file,
      snapshotInfo.file,
      oldContent,
      newContent,
      'old',
      'new'
    );

    const patchFileName = \`\${path.basename(snapshotInfo.file, '.js')}-\${Date.now()}.patch\`;
    const patchFilePath = path.join(
      path.dirname(snapshotInfo.file),
      patchFileName
    );

    await fs.writeFile(patchFilePath, patch, 'utf-8');

    return patchFilePath;
  }
}

module.exports = { SnapshotUpdater };
`;

// Continue with validators and components in next part...
console.log('Creating implementation files (Part 1/3)...\n');

// Due to length, I'll split into multiple parts
// Let me know if you want me to continue with the rest!

// Continuing add-implementation-files.js - Part 2/3

// ============================================================================
// VALIDATORS: snapshot-validator.js - FULL IMPLEMENTATION
// ============================================================================
implementationFiles['src/validators/snapshot-validator.js'] = `const { chromium } = require('playwright');
const { AriaSnapshotGenerator } = require('../core/aria-snapshot-generator');
const chalk = require('chalk');

class SnapshotValidator {
  constructor(options = {}) {
    this.options = options;
    this.browser = null;
    this.context = null;
    this.results = [];
  }

  async init() {
    this.browser = await chromium.launch({
      headless: this.options.headless !== false,
    });
    this.context = await this.browser.newContext(this.options.contextOptions || {});
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async validateSnapshot(url, selector, expectedSnapshot, options = {}) {
    const page = await this.context.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      
      const generator = new AriaSnapshotGenerator(page);
      const actualSnapshot = await generator.generateEnhancedSnapshot(selector, {
        includeComponentAttrs: true,
        includeRowData: options.includeRowData || false,
        maxRows: options.maxRows || 3,
      });

      const expected = this.parseSnapshot(expectedSnapshot);
      const actual = this.parseSnapshot(actualSnapshot);

      const result = this.compareSnapshots(expected, actual, selector);
      
      this.results.push({
        url,
        selector,
        passed: result.passed,
        differences: result.differences,
        expected: expectedSnapshot,
        actual: actualSnapshot,
      });

      return result;
    } catch (error) {
      this.results.push({
        url,
        selector,
        passed: false,
        error: error.message,
      });
      throw error;
    } finally {
      await page.close();
    }
  }

  parseSnapshot(snapshotString) {
    const lines = snapshotString.trim().split('\\n');
    const parsed = {
      role: null,
      name: null,
      attributes: {},
      children: [],
      comments: [],
    };

    lines.forEach(line => {
      const trimmed = line.trim();
      
      if (!trimmed) return;

      if (trimmed.startsWith('#')) {
        parsed.comments.push(trimmed.substring(1).trim());
        return;
      }

      const mainLineMatch = trimmed.match(/^-\\s+(\\w+)(?:\\s+"([^"]*)")?(?:\\s+\\[([^\\]]+)\\])?/);
      
      if (mainLineMatch) {
        parsed.role = mainLineMatch[1];
        parsed.name = mainLineMatch[2] || null;
        
        if (mainLineMatch[3]) {
          const attrString = mainLineMatch[3];
          this.parseAttributes(attrString, parsed.attributes);
        }
      }
    });

    return parsed;
  }

  parseAttributes(attrString, targetObj) {
    const attrRegex = /(\\w+(?:-\\w+)*)=(?:"([^"]*)"|(\\[[^\\]]*\\])|(\\w+))/g;
    let match;

    while ((match = attrRegex.exec(attrString)) !== null) {
      const key = match[1];
      let value;

      if (match[2] !== undefined) {
        value = match[2];
      } else if (match[3] !== undefined) {
        try {
          value = JSON.parse(match[3]);
        } catch (e) {
          value = match[3];
        }
      } else if (match[4] !== undefined) {
        const unquoted = match[4];
        if (unquoted === 'true') value = true;
        else if (unquoted === 'false') value = false;
        else if (!isNaN(unquoted)) value = Number(unquoted);
        else value = unquoted;
      }

      targetObj[key] = value;
    }
  }

  compareSnapshots(expected, actual, selector) {
    const differences = [];
    
    if (expected.role !== actual.role) {
      differences.push({
        type: 'role-mismatch',
        field: 'role',
        expected: expected.role,
        actual: actual.role,
        severity: 'error',
      });
    }

    if (expected.name && !this.matchValue(actual.name, expected.name)) {
      differences.push({
        type: 'name-mismatch',
        field: 'name',
        expected: expected.name,
        actual: actual.name,
        severity: 'warning',
      });
    }

    this.compareAttributes(expected.attributes, actual.attributes, differences);

    return {
      passed: differences.filter(d => d.severity === 'error').length === 0,
      differences,
      selector,
    };
  }

  compareAttributes(expected, actual, differences) {
    for (const [key, expectedValue] of Object.entries(expected)) {
      if (!(key in actual)) {
        differences.push({
          type: 'attribute-missing',
          field: key,
          expected: expectedValue,
          actual: undefined,
          severity: 'error',
        });
        continue;
      }

      const actualValue = actual[key];
      
      if (!this.compareAttributeValues(key, expectedValue, actualValue)) {
        differences.push({
          type: 'attribute-mismatch',
          field: key,
          expected: expectedValue,
          actual: actualValue,
          severity: this.getAttributeSeverity(key),
        });
      }
    }

    if (this.options.strict) {
      for (const key of Object.keys(actual)) {
        if (!(key in expected)) {
          differences.push({
            type: 'attribute-unexpected',
            field: key,
            expected: undefined,
            actual: actual[key],
            severity: 'warning',
          });
        }
      }
    }
  }

  compareAttributeValues(key, expected, actual) {
    if (Array.isArray(expected)) {
      if (!Array.isArray(actual)) return false;
      
      if (this.options.arrayMatchMode === 'subset') {
        return expected.every(item => actual.includes(item));
      } else if (this.options.arrayMatchMode === 'exact') {
        return JSON.stringify(expected) === JSON.stringify(actual);
      } else {
        if (expected.length !== actual.length) return false;
        return expected.every((item, idx) => this.matchValue(actual[idx], item));
      }
    }

    if (typeof expected === 'number' && typeof actual === 'number') {
      if (key.endsWith('-count')) {
        const tolerance = this.options.countTolerance || 0;
        return Math.abs(expected - actual) <= tolerance;
      }
      return expected === actual;
    }

    if (typeof expected === 'boolean') {
      return expected === actual;
    }

    return this.matchValue(actual, expected);
  }

  matchValue(actual, expected) {
    if (expected === null || expected === undefined) return true;
    if (actual === expected) return true;

    if (typeof expected === 'string' && expected.startsWith('/') && expected.endsWith('/')) {
      const pattern = expected.slice(1, -1);
      try {
        const regex = new RegExp(pattern);
        return regex.test(String(actual));
      } catch (e) {
        console.warn(\`Invalid regex pattern: \${pattern}\`);
        return false;
      }
    }

    return false;
  }

  getAttributeSeverity(attributeName) {
    const critical = ['role', 'row-count', 'column-count', 'required'];
    if (critical.includes(attributeName)) return 'error';

    const important = ['columns', 'headers', 'sortable', 'filterable', 'multi-select'];
    if (important.includes(attributeName)) return 'warning';

    return 'info';
  }

  generateReport() {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    const report = {
      summary: {
        total,
        passed,
        failed,
        passRate: total > 0 ? ((passed / total) * 100).toFixed(2) + '%' : '0%',
      },
      results: this.results,
    };

    return report;
  }

  printReport() {
    const report = this.generateReport();
    
    console.log('\\n' + chalk.bold('📊 Validation Report'));
    console.log(chalk.gray('='.repeat(60)));
    
    console.log(chalk.cyan(\`Total Snapshots: \${report.summary.total}\`));
    console.log(chalk.green(\`✓ Passed: \${report.summary.passed}\`));
    console.log(chalk.red(\`✗ Failed: \${report.summary.failed}\`));
    console.log(chalk.blue(\`Pass Rate: \${report.summary.passRate}\`));
    
    console.log('\\n' + chalk.bold('Details:'));
    console.log(chalk.gray('='.repeat(60)));

    this.results.forEach((result, idx) => {
      const status = result.passed ? chalk.green('✓ PASS') : chalk.red('✗ FAIL');
      console.log(\`\\n\${idx + 1}. \${status} \${chalk.cyan(result.selector)}\`);
      console.log(chalk.gray(\`   URL: \${result.url}\`));

      if (!result.passed && result.differences) {
        result.differences.forEach(diff => {
          const icon = diff.severity === 'error' ? '❌' : 
                      diff.severity === 'warning' ? '⚠️' : 'ℹ️';
          
          console.log(\`   \${icon} \${chalk.yellow(diff.type)}: \${diff.field}\`);
          console.log(\`      Expected: \${chalk.green(JSON.stringify(diff.expected))}\`);
          console.log(\`      Actual:   \${chalk.red(JSON.stringify(diff.actual))}\`);
        });
      }

      if (result.error) {
        console.log(chalk.red(\`   Error: \${result.error}\`));
      }
    });

    console.log('\\n' + chalk.gray('='.repeat(60)) + '\\n');
  }
}

module.exports = { SnapshotValidator };
`;

// ============================================================================
// VALIDATORS: playwright-test-validator.js - FULL IMPLEMENTATION
// ============================================================================
implementationFiles['src/validators/playwright-test-validator.js'] = `const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');
const { promisify } = require('util');
const { SnapshotValidator } = require('./snapshot-validator');

const globAsync = promisify(glob);

class PlaywrightTestValidator extends SnapshotValidator {
  constructor(options = {}) {
    super(options);
    this.testFiles = [];
    this.snapshots = [];
  }

  async parseTestFiles(testPattern) {
    this.testFiles = await globAsync(testPattern, {
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    });

    console.log(\`Found \${this.testFiles.length} test files\`);

    for (const file of this.testFiles) {
      await this.parseTestFile(file);
    }
  }

  async parseTestFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    
    const snapshotRegex = /expect\\(.*?\\.locator\\(['"]([^'"]+)['"]\\)\\)\\.toMatchComponentSnapshot\\([^\`]*\\\`([^\`]*)\\\`\\)/gs;
    
    let match;
    while ((match = snapshotRegex.exec(content)) !== null) {
      const selector = match[1];
      const snapshot = match[2];
      
      this.snapshots.push({
        file: filePath,
        selector,
        snapshot,
      });
    }

    const ariaSnapshotRegex = /expect\\(.*?\\.locator\\(['"]([^'"]+)['"]\\)\\)\\.toMatchAriaSnapshot\\([^\`]*\\\`([^\`]*)\\\`\\)/gs;
    
    while ((match = ariaSnapshotRegex.exec(content)) !== null) {
      const selector = match[1];
      const snapshot = match[2];
      
      this.snapshots.push({
        file: filePath,
        selector,
        snapshot,
      });
    }

    const snapshotDir = filePath.replace(/\\.spec\\.(js|ts)$/, '.spec.$1-snapshots');
    try {
      const stats = await fs.stat(snapshotDir);
      if (stats.isDirectory()) {
        const files = await fs.readdir(snapshotDir);
        for (const file of files) {
          if (file.endsWith('.aria.yml')) {
            const snapshotContent = await fs.readFile(
              path.join(snapshotDir, file),
              'utf-8'
            );
            
            const selectorMatch = file.match(/^(.+?)(?:-\\d+)?\\.aria\\.yml$/);
            const selector = selectorMatch ? selectorMatch[1] : 'body';
            
            this.snapshots.push({
              file: filePath,
              snapshotFile: path.join(snapshotDir, file),
              selector,
              snapshot: snapshotContent,
            });
          }
        }
      }
    } catch (e) {
      // No snapshot directory
    }
  }

  async validateAll(baseUrl) {
    await this.init();

    try {
      for (const snapshot of this.snapshots) {
        const url = baseUrl || 'http://localhost:3000';
        
        console.log(\`Validating: \${snapshot.selector} from \${path.basename(snapshot.file)}\`);
        
        try {
          await this.validateSnapshot(
            url,
            snapshot.selector,
            snapshot.snapshot,
            this.options
          );
        } catch (error) {
          console.error(\`Failed to validate \${snapshot.selector}: \${error.message}\`);
        }
      }

      return this.generateReport();
    } finally {
      await this.close();
    }
  }
}

module.exports = { PlaywrightTestValidator };
`;

// ============================================================================
// VALIDATORS: custom-matchers.js - FULL IMPLEMENTATION
// ============================================================================
implementationFiles['src/validators/custom-matchers.js'] = `const { expect } = require('@playwright/test');
const { AriaSnapshotGenerator } = require('../core/aria-snapshot-generator');
const { SnapshotValidator } = require('./snapshot-validator');

expect.extend({
  async toMatchComponentSnapshot(locator, expectedSnapshot, options = {}) {
    const page = locator.page();
    const selector = await locator.evaluate(el => {
      if (el.id) return \`#\${el.id}\`;
      if (el.className) return \`.\${el.className.split(' ')[0]}\`;
      return el.tagName.toLowerCase();
    });

    const generator = new AriaSnapshotGenerator(page);
    const actualSnapshot = await generator.generateEnhancedSnapshot(selector, {
      includeComponentAttrs: true,
      includeRowData: options.includeRowData || false,
      maxRows: options.maxRows || 3,
    });

    const validator = new SnapshotValidator(options);
    const expected = validator.parseSnapshot(expectedSnapshot);
    const actual = validator.parseSnapshot(actualSnapshot);
    const result = validator.compareSnapshots(expected, actual, selector);

    if (result.passed) {
      return {
        pass: true,
        message: () => \`Component snapshot matches for \${selector}\`,
      };
    } else {
      const diffMessages = result.differences.map(diff => 
        \`  \${diff.field}: expected \${JSON.stringify(diff.expected)}, got \${JSON.stringify(diff.actual)}\`
      ).join('\\n');

      return {
        pass: false,
        message: () => 
          \`Component snapshot mismatch for \${selector}:\\n\${diffMessages}\\n\\nExpected:\\n\${expectedSnapshot}\\n\\nActual:\\n\${actualSnapshot}\`,
      };
    }
  },

  async toHaveComponentAttributes(locator, expectedAttrs) {
    const page = locator.page();
    const selector = await locator.evaluate(el => {
      if (el.id) return \`#\${el.id}\`;
      return 'unknown';
    });

    const generator = new AriaSnapshotGenerator(page);
    const snapshot = await generator.generateEnhancedSnapshot(selector, {
      includeComponentAttrs: true,
    });

    const validator = new SnapshotValidator();
    const parsed = validator.parseSnapshot(snapshot);
    const actualAttrs = parsed.attributes;

    const mismatches = [];
    for (const [key, expectedValue] of Object.entries(expectedAttrs)) {
      if (!(key in actualAttrs)) {
        mismatches.push(\`Missing attribute: \${key}\`);
      } else if (!validator.compareAttributeValues(key, expectedValue, actualAttrs[key])) {
        mismatches.push(
          \`\${key}: expected \${JSON.stringify(expectedValue)}, got \${JSON.stringify(actualAttrs[key])}\`
        );
      }
    }

    if (mismatches.length === 0) {
      return {
        pass: true,
        message: () => \`Component has expected attributes\`,
      };
    } else {
      return {
        pass: false,
        message: () => \`Component attribute mismatches:\\n\${mismatches.join('\\n')}\`,
      };
    }
  },
});

module.exports = { expect };
`;

console.log('✅ Created validator files\n');
console.log('Creating component files (Part 2/3)...\n');

// Continue with Part 3 for components...

// add-implementation-files.js - COMPLETE PART 3/3

// Continuing from Part 2...

console.log('Creating component files (Part 3/3)...\n');

// ============================================================================
// COMPONENTS - FULL IMPLEMENTATIONS
// ============================================================================

implementationFiles['src/components/grid.js'] = `const { BaseComponent } = require('./base');

class GridComponent extends BaseComponent {
  static detect(element) {
    return (
      element.id === 'grid' ||
      element.classList.contains('ag-grid') ||
      element.classList.contains('data-grid') ||
      element.getAttribute('role') === 'grid' ||
      element.hasAttribute('data-grid')
    );
  }

  getRole() {
    return 'grid';
  }

  getCustomAttributes() {
    const attrs = {};
    
    const rows = this.element.querySelectorAll('[role="row"], .grid-row, .ag-row');
    if (rows.length > 0) {
      attrs['row-count'] = rows.length;
    }

    const headerCells = this.element.querySelectorAll(
      '[role="columnheader"], .grid-header-cell, .ag-header-cell'
    );
    if (headerCells.length > 0) {
      attrs['column-count'] = headerCells.length;
    }

    const headers = Array.from(headerCells).map(cell => 
      cell.textContent.trim()
    ).filter(Boolean);
    if (headers.length > 0) {
      attrs['columns'] = headers;
    }

    const sortable = this.element.querySelector('[aria-sort], .sortable, .ag-header-cell-sortable');
    if (sortable) {
      attrs['sortable'] = true;
    }

    const filterable = this.element.querySelector('.filter, .ag-filter, [data-filter]');
    if (filterable) {
      attrs['filterable'] = true;
    }

    const selectable = this.element.querySelector('[aria-selected], .selected, .ag-row-selected');
    if (selectable) {
      attrs['selectable'] = true;
      
      const multiSelect = this.element.querySelector('input[type="checkbox"]');
      attrs['selection-mode'] = multiSelect ? 'multiple' : 'single';
    }

    const pagination = this.element.querySelector('.pagination, .ag-paging-panel');
    if (pagination) {
      attrs['paginated'] = true;
      
      const pageInfo = pagination.textContent.match(/(\\d+)\\s*of\\s*(\\d+)/);
      if (pageInfo) {
        attrs['current-page'] = parseInt(pageInfo[1]);
        attrs['total-pages'] = parseInt(pageInfo[2]);
      }
    }

    const virtualScroll = this.element.querySelector('.virtual-scroll, .ag-virtual-scroll');
    if (virtualScroll) {
      attrs['virtual-scroll'] = true;
    }

    return attrs;
  }

  getRowData(limit = 3) {
    const rows = this.element.querySelectorAll('[role="row"], .grid-row, .ag-row');
    const data = [];

    for (let i = 0; i < Math.min(limit, rows.length); i++) {
      const cells = rows[i].querySelectorAll('[role="gridcell"], .grid-cell, .ag-cell');
      const rowData = Array.from(cells).map(cell => cell.textContent.trim());
      data.push(rowData);
    }

    return data;
  }
}

module.exports = { GridComponent };
`;

implementationFiles['src/components/table.js'] = `const { BaseComponent } = require('./base');

class TableComponent extends BaseComponent {
  static detect(element) {
    return (
      element.tagName === 'TABLE' ||
      element.getAttribute('role') === 'table' ||
      element.classList.contains('data-table')
    );
  }

  getRole() {
    return 'table';
  }

  getCustomAttributes() {
    const attrs = {};

    const rows = this.element.querySelectorAll('tr, [role="row"]');
    const headerRow = this.element.querySelector('thead tr, [role="rowgroup"]:first-child [role="row"]');
    
    if (rows.length > 0) {
      attrs['row-count'] = rows.length - (headerRow ? 1 : 0);
    }

    if (headerRow) {
      const headers = headerRow.querySelectorAll('th, [role="columnheader"]');
      attrs['column-count'] = headers.length;
      attrs['headers'] = Array.from(headers).map(h => h.textContent.trim());
    }

    if (this.element.classList.contains('responsive-table') || 
        this.element.hasAttribute('data-responsive')) {
      attrs['responsive'] = true;
    }

    const striped = this.element.querySelector('.striped, tbody tr:nth-child(even)[class*="alt"]');
    if (striped) {
      attrs['striped'] = true;
    }

    return attrs;
  }
}

module.exports = { TableComponent };
`;

implementationFiles['src/components/dropdown.js'] = `const { BaseComponent } = require('./base');

class DropdownComponent extends BaseComponent {
  static detect(element) {
    return (
      element.getAttribute('role') === 'combobox' ||
      element.getAttribute('role') === 'listbox' ||
      element.classList.contains('dropdown') ||
      element.classList.contains('select') ||
      element.tagName === 'SELECT' ||
      element.hasAttribute('data-dropdown')
    );
  }

  getRole() {
    return 'combobox';
  }

  getCustomAttributes() {
    const attrs = {};

    const multiSelect = this.element.hasAttribute('multiple') ||
                       this.element.getAttribute('aria-multiselectable') === 'true';
    if (multiSelect) {
      attrs['multi-select'] = true;
    }

    const searchable = this.element.querySelector('input[type="search"], input[type="text"]') ||
                      this.element.hasAttribute('data-searchable');
    if (searchable) {
      attrs['searchable'] = true;
    }

    const options = this.getOptions();
    if (options.length > 0) {
      attrs['option-count'] = options.length;
      
      if (options.length <= 5) {
        attrs['options'] = options;
      } else {
        attrs['options-sample'] = options.slice(0, 5);
      }
    }

    const selected = this.getSelectedOptions();
    if (selected.length > 0) {
      attrs['selected'] = multiSelect ? selected : selected[0];
    }

    if (this.element.hasAttribute('disabled') || 
        this.element.getAttribute('aria-disabled') === 'true') {
      attrs['disabled'] = true;
    }

    const placeholder = this.element.getAttribute('placeholder') ||
                       this.element.querySelector('[class*="placeholder"]')?.textContent;
    if (placeholder) {
      attrs['placeholder'] = placeholder.trim();
    }

    return attrs;
  }

  getOptions() {
    const optionElements = this.element.querySelectorAll(
      'option, [role="option"], .dropdown-option, .select-option'
    );
    
    return Array.from(optionElements)
      .map(opt => opt.textContent.trim())
      .filter(Boolean);
  }

  getSelectedOptions() {
    if (this.element.tagName === 'SELECT') {
      const selectedOptions = this.element.querySelectorAll('option:checked');
      return Array.from(selectedOptions).map(opt => opt.textContent.trim());
    }

    const selected = this.element.querySelectorAll(
      '[aria-selected="true"], .selected, .dropdown-option.active'
    );
    return Array.from(selected).map(opt => opt.textContent.trim());
  }
}

module.exports = { DropdownComponent };
`;

implementationFiles['src/components/modal.js'] = `const { BaseComponent } = require('./base');

class ModalComponent extends BaseComponent {
  static detect(element) {
    return (
      element.getAttribute('role') === 'dialog' ||
      element.getAttribute('role') === 'alertdialog' ||
      element.classList.contains('modal') ||
      element.classList.contains('dialog') ||
      element.hasAttribute('data-modal')
    );
  }

  getRole() {
    const role = this.element.getAttribute('role');
    return role === 'alertdialog' ? 'alertdialog' : 'dialog';
  }

  getCustomAttributes() {
    const attrs = {};

    const sizeClasses = ['small', 'medium', 'large', 'xl', 'fullscreen'];
    for (const size of sizeClasses) {
      if (this.element.classList.contains(size) || 
          this.element.classList.contains(\`modal-\${size}\`)) {
        attrs['size'] = size;
        break;
      }
    }

    const title = this.element.querySelector(
      '[role="heading"], .modal-title, .dialog-title, h1, h2, h3'
    );
    if (title) {
      attrs['title'] = title.textContent.trim();
    }

    const closeButton = this.element.querySelector(
      '[aria-label*="close" i], .close, .modal-close, button[data-dismiss]'
    );
    if (closeButton) {
      attrs['closeable'] = true;
    }

    const backdrop = document.querySelector('.modal-backdrop, .overlay, .dialog-backdrop');
    if (backdrop) {
      attrs['has-backdrop'] = true;
      
      const backdropClickClose = backdrop.hasAttribute('data-dismiss') ||
                                backdrop.classList.contains('dismiss-on-click');
      if (backdropClickClose) {
        attrs['backdrop-dismissible'] = true;
      }
    }

    const footer = this.element.querySelector('.modal-footer, .dialog-footer, [role="group"]');
    if (footer) {
      const buttons = footer.querySelectorAll('button');
      if (buttons.length > 0) {
        attrs['footer-actions'] = Array.from(buttons)
          .map(btn => btn.textContent.trim())
          .filter(Boolean);
      }
    }

    const isOpen = this.element.classList.contains('show') ||
                  this.element.classList.contains('open') ||
                  this.element.getAttribute('aria-hidden') === 'false' ||
                  window.getComputedStyle(this.element).display !== 'none';
    attrs['open'] = isOpen;

    return attrs;
  }
}

module.exports = { ModalComponent };
`;

implementationFiles['src/components/form.js'] = `const { BaseComponent } = require('./base');

class FormComponent extends BaseComponent {
  static detect(element) {
    return (
      element.tagName === 'FORM' ||
      element.getAttribute('role') === 'form' ||
      element.classList.contains('form') ||
      element.hasAttribute('data-form')
    );
  }

  getRole() {
    return 'form';
  }

  getCustomAttributes() {
    const attrs = {};

    const name = this.element.getAttribute('name') || 
                this.element.getAttribute('id');
    if (name) {
      attrs['name'] = name;
    }

    const method = this.element.getAttribute('method');
    if (method) {
      attrs['method'] = method.toUpperCase();
    }

    const fields = this.getFormFields();
    attrs['field-count'] = fields.length;

    if (fields.length > 0) {
      const fieldTypes = {};
      fields.forEach(field => {
        const type = field.type || 'text';
        fieldTypes[type] = (fieldTypes[type] || 0) + 1;
      });
      attrs['field-types'] = fieldTypes;

      const fieldNames = fields
        .map(field => field.label || field.name || field.placeholder)
        .filter(Boolean);
      if (fieldNames.length > 0 && fieldNames.length <= 10) {
        attrs['fields'] = fieldNames;
      }
    }

    const hasValidation = this.element.querySelector('[required], [pattern]') ||
                         this.element.hasAttribute('novalidate') === false;
    if (hasValidation) {
      attrs['validation'] = true;
    }

    const submitButton = this.element.querySelector(
      'button[type="submit"], input[type="submit"]'
    );
    if (submitButton) {
      attrs['submit-button'] = submitButton.textContent.trim() || 
                              submitButton.value || 
                              'Submit';
    }

    const errors = this.element.querySelectorAll(
      '.error, .invalid, [aria-invalid="true"], .form-error'
    );
    if (errors.length > 0) {
      attrs['has-errors'] = true;
      attrs['error-count'] = errors.length;
    }

    const steps = this.element.querySelectorAll('.step, .form-step, [data-step]');
    if (steps.length > 1) {
      attrs['multi-step'] = true;
      attrs['step-count'] = steps.length;
      
      const currentStep = this.element.querySelector('.step.active, .step.current');
      if (currentStep) {
        const stepIndex = Array.from(steps).indexOf(currentStep);
        attrs['current-step'] = stepIndex + 1;
      }
    }

    return attrs;
  }

  getFormFields() {
    const fields = [];
    const inputs = this.element.querySelectorAll(
      'input, select, textarea, [role="textbox"], [role="combobox"]'
    );

    inputs.forEach(input => {
      if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') {
        return;
      }

      const field = {
        type: input.type || input.tagName.toLowerCase(),
        name: input.getAttribute('name'),
        id: input.getAttribute('id'),
      };

      const label = this.findLabel(input);
      if (label) {
        field.label = label;
      }

      const placeholder = input.getAttribute('placeholder');
      if (placeholder) {
        field.placeholder = placeholder;
      }

      fields.push(field);
    });

    return fields;
  }

  findLabel(input) {
    const inputId = input.getAttribute('id');
    if (inputId) {
      const label = this.element.querySelector(\`label[for="\${inputId}"]\`);
      if (label) return label.textContent.trim();
    }

    const parentLabel = input.closest('label');
    if (parentLabel) {
      return parentLabel.textContent.trim();
    }

    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    const labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement) return labelElement.textContent.trim();
    }

    return null;
  }
}

module.exports = { FormComponent };
`;

implementationFiles['src/components/tabs.js'] = `const { BaseComponent } = require('./base');

class TabsComponent extends BaseComponent {
  static detect(element) {
    return (
      element.getAttribute('role') === 'tablist' ||
      element.classList.contains('tabs') ||
      element.classList.contains('tab-list') ||
      element.hasAttribute('data-tabs')
    );
  }

  getRole() {
    return 'tablist';
  }

  getCustomAttributes() {
    const attrs = {};

    const tabs = this.getTabs();
    if (tabs.length > 0) {
      attrs['tab-count'] = tabs.length;
      attrs['tabs'] = tabs.map(tab => tab.label);

      const activeTab = tabs.find(tab => tab.active);
      if (activeTab) {
        attrs['active-tab'] = activeTab.label;
        attrs['active-tab-index'] = tabs.indexOf(activeTab);
      }
    }

    const orientation = this.element.getAttribute('aria-orientation');
    if (orientation && orientation !== 'horizontal') {
      attrs['orientation'] = orientation;
    }

    const closeButtons = this.element.querySelectorAll(
      '.close, .tab-close, [aria-label*="close" i]'
    );
    if (closeButtons.length > 0) {
      attrs['closeable-tabs'] = true;
    }

    return attrs;
  }

  getTabs() {
    const tabElements = this.element.querySelectorAll(
      '[role="tab"], .tab, .nav-item'
    );

    return Array.from(tabElements).map(tabEl => {
      const label = tabEl.textContent.trim();
      const active = tabEl.getAttribute('aria-selected') === 'true' ||
                    tabEl.classList.contains('active') ||
                    tabEl.classList.contains('selected');
      const disabled = tabEl.getAttribute('aria-disabled') === 'true' ||
                      tabEl.hasAttribute('disabled') ||
                      tabEl.classList.contains('disabled');

      return { label, active, disabled };
    });
  }
}

module.exports = { TabsComponent };
`;

implementationFiles['src/components/accordion.js'] = `const { BaseComponent } = require('./base');

class AccordionComponent extends BaseComponent {
  static detect(element) {
    return (
      element.classList.contains('accordion') ||
      element.hasAttribute('data-accordion') ||
      (element.querySelector('[role="button"][aria-expanded]') && 
       element.querySelector('[role="region"]'))
    );
  }

  getRole() {
    return 'accordion';
  }

  getCustomAttributes() {
    const attrs = {};

    const items = this.getAccordionItems();
    if (items.length > 0) {
      attrs['item-count'] = items.length;
      attrs['items'] = items.map(item => ({
        label: item.label,
        expanded: item.expanded,
      }));

      const expandedCount = items.filter(item => item.expanded).length;
      attrs['expanded-count'] = expandedCount;

      const allowMultiple = expandedCount > 1 || 
                           this.element.hasAttribute('data-allow-multiple');
      if (allowMultiple) {
        attrs['allow-multiple'] = true;
      }
    }

    const allowAllCollapsed = !this.element.hasAttribute('data-require-one-open');
    if (!allowAllCollapsed) {
      attrs['require-one-open'] = true;
    }

    return attrs;
  }

  getAccordionItems() {
    const items = [];
    
    const itemElements = this.element.querySelectorAll(
      '.accordion-item, .accordion-section, [data-accordion-item]'
    );

    itemElements.forEach(itemEl => {
      const button = itemEl.querySelector(
        '[role="button"], button, .accordion-header, .accordion-button'
      );
      
      if (button) {
        const label = button.textContent.trim();
        const expanded = button.getAttribute('aria-expanded') === 'true' ||
                        itemEl.classList.contains('open') ||
                        itemEl.classList.contains('expanded');

        items.push({ label, expanded });
      }
    });

    return items;
  }
}

module.exports = { AccordionComponent };
`;

implementationFiles['src/components/pagination.js'] = `const { BaseComponent } = require('./base');

class PaginationComponent extends BaseComponent {
  static detect(element) {
    return (
      element.getAttribute('role') === 'navigation' && 
      element.getAttribute('aria-label')?.toLowerCase().includes('pagination') ||
      element.classList.contains('pagination') ||
      element.classList.contains('pager') ||
      element.hasAttribute('data-pagination')
    );
  }

  getRole() {
    return 'navigation';
  }

  getCustomAttributes() {
    const attrs = {};

    const currentPage = this.getCurrentPage();
    if (currentPage) {
      attrs['current-page'] = currentPage;
    }

    const totalPages = this.getTotalPages();
    if (totalPages) {
      attrs['total-pages'] = totalPages;
    }

    const prevButton = this.element.querySelector(
      '[aria-label*="previous" i], .prev, .previous, [data-page="prev"]'
    );
    const nextButton = this.element.querySelector(
      '[aria-label*="next" i], .next, [data-page="next"]'
    );

    if (prevButton) {
      attrs['has-prev'] = !prevButton.hasAttribute('disabled') &&
                         prevButton.getAttribute('aria-disabled') !== 'true';
    }
    if (nextButton) {
      attrs['has-next'] = !nextButton.hasAttribute('disabled') &&
                         nextButton.getAttribute('aria-disabled') !== 'true';
    }

    const firstButton = this.element.querySelector(
      '[aria-label*="first" i], .first, [data-page="first"]'
    );
    const lastButton = this.element.querySelector(
      '[aria-label*="last" i], .last, [data-page="last"]'
    );

    if (firstButton || lastButton) {
      attrs['has-first-last'] = true;
    }

    const itemsPerPageText = this.element.textContent.match(/(\\d+)\\s+per\\s+page/i);
    if (itemsPerPageText) {
      attrs['items-per-page'] = parseInt(itemsPerPageText[1]);
    }

    const totalItemsText = this.element.textContent.match(/of\\s+(\\d+)\\s+items/i);
    if (totalItemsText) {
      attrs['total-items'] = parseInt(totalItemsText[1]);
    }

    return attrs;
  }

  getCurrentPage() {
    const active = this.element.querySelector(
      '[aria-current="page"], .active, .current, [data-page].active'
    );
    
    if (active) {
      const pageText = active.textContent.trim();
      const pageNum = parseInt(pageText);
      if (!isNaN(pageNum)) return pageNum;
    }

    return null;
  }

  getTotalPages() {
    const pageLinks = this.element.querySelectorAll(
      'a[data-page], button[data-page], .page-link'
    );
    
    let maxPage = 0;
    pageLinks.forEach(link => {
      const pageText = link.textContent.trim();
      const pageNum = parseInt(pageText);
      if (!isNaN(pageNum) && pageNum > maxPage) {
        maxPage = pageNum;
      }
    });

    if (maxPage > 0) return maxPage;

    const totalPagesText = this.element.textContent.match(/of\\s+(\\d+)/i);
    if (totalPagesText) {
      return parseInt(totalPagesText[1]);
    }

    return null;
  }
}

module.exports = { PaginationComponent };
`;

implementationFiles['src/components/tree.js'] = `const { BaseComponent } = require('./base');

class TreeComponent extends BaseComponent {
  static detect(element) {
    return (
      element.getAttribute('role') === 'tree' ||
      element.classList.contains('tree') ||
      element.classList.contains('tree-view') ||
      element.hasAttribute('data-tree')
    );
  }

  getRole() {
    return 'tree';
  }

  getCustomAttributes() {
    const attrs = {};

    const items = this.getTreeItems();
    if (items.length > 0) {
      attrs['item-count'] = items.length;

      const expanded = items.filter(item => item.expanded).length;
      const collapsed = items.filter(item => !item.expanded && item.hasChildren).length;
      
      if (expanded > 0) attrs['expanded-count'] = expanded;
      if (collapsed > 0) attrs['collapsed-count'] = collapsed;

      const leafNodes = items.filter(item => !item.hasChildren).length;
      attrs['leaf-count'] = leafNodes;

      const maxDepth = Math.max(...items.map(item => item.level));
      attrs['max-depth'] = maxDepth;
    }

    const multiSelect = this.element.getAttribute('aria-multiselectable') === 'true' ||
                       this.element.querySelector('[role="treeitem"] input[type="checkbox"]');
    if (multiSelect) {
      attrs['multi-select'] = true;
    }

    const selected = items.filter(item => item.selected);
    if (selected.length > 0) {
      attrs['selected-count'] = selected.length;
      if (selected.length <= 5) {
        attrs['selected-items'] = selected.map(item => item.label);
      }
    }

    return attrs;
  }

  getTreeItems() {
    const items = [];
    const itemElements = this.element.querySelectorAll(
      '[role="treeitem"], .tree-item, .tree-node'
    );

    itemElements.forEach(itemEl => {
      const label = itemEl.textContent.trim();
      const expanded = itemEl.getAttribute('aria-expanded') === 'true';
      const selected = itemEl.getAttribute('aria-selected') === 'true' ||
                      itemEl.classList.contains('selected');
      const hasChildren = itemEl.getAttribute('aria-expanded') !== null ||
                         itemEl.querySelector('[role="group"]') !== null;
      
      let level = 0;
      let parent = itemEl.parentElement;
      while (parent && parent !== this.element) {
        if (parent.getAttribute('role') === 'group') {
          level++;
        }
        parent = parent.parentElement;
      }

      items.push({ label, expanded, selected, hasChildren, level });
    });

    return items;
  }
}

module.exports = { TreeComponent };
`;

// ============================================================================
// WRITE ALL FILES TO DISK
// ============================================================================

console.log('\\nWriting all implementation files to disk...\\n');

let successCount = 0;
let errorCount = 0;

for (const [filename, content] of Object.entries(implementationFiles)) {
    try {
        fs.writeFileSync(filename, content);
        successCount++;
        console.log(`  ✅ ${filename}`);
  } catch (error) {
    errorCount++;
    console.error(`  ❌ Failed to create ${filename}: ${error.message}`);
  }
}

console.log(`\n✨ Successfully created ${successCount} implementation files!`);
if (errorCount > 0) {
  console.log(`⚠️  Failed to create ${errorCount} files`);
}

console.log('\n📦 Full implementation complete!\n');
console.log('═'.repeat(60));
console.log('\n🎉 Next Steps:\n');
console.log('  1️⃣  npm install');
console.log('  2️⃣  npm run install-browsers');
console.log('  3️⃣  chmod +x src/cli.js');
console.log('  4️⃣  npm link');
console.log('  5️⃣  playwright-recorder --help');
console.log('  6️⃣  playwright-recorder record --url http://localhost:3000\\n');
console.log('═'.repeat(60));
console.log('\n📚 Features Available:\n');
console.log('  ✓ Record user actions (clicks, fills, navigation)');
console.log('  ✓ Capture component snapshots with custom attributes');
console.log('  ✓ Support for Grid, Table, Form, Modal, Tabs, Accordion, etc.');
console.log('  ✓ Validate snapshots against live pages');
console.log('  ✓ Update snapshots with patch files');
console.log('  ✓ Real-time code preview in recorder UI');
console.log('  ✓ Custom matchers for Playwright Test\n');
console.log('🚀 Your Playwright Recorder CLI is ready!\n');