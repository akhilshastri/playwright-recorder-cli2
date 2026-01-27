const { chromium } = require('playwright');
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
        if (element.id) return `#${element.id}`;
        if (element.name) return `[name="${element.name}"]`;
        
        const testId = element.getAttribute('data-testid');
        if (testId) return `[data-testid="${testId}"]`;
        
        if (element.className && typeof element.className === 'string') {
          const classes = element.className.split(' ').filter(Boolean);
          if (classes.length > 0) return `.${classes[0]}`;
        }
        
        return element.tagName.toLowerCase();
      };
    });
  }

  async injectRecorderUI() {
    await this.page.evaluate(() => {
      const recorderUI = document.createElement('div');
      recorderUI.id = 'custom-recorder-ui';
      recorderUI.innerHTML = `
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
      `;
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
        document.getElementById('recorder-status').textContent = `✅ Saved: ${result}`;
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

          document.getElementById('recorder-status').innerHTML = `✅ Captured ${selector}!`;
          
          setTimeout(() => {
            document.getElementById('recorder-status').textContent = '✅ Recording... Interact with the page';
          }, 2000);
        } catch (error) {
          document.getElementById('recorder-status').textContent = `❌ Error: ${error.message}`;
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
