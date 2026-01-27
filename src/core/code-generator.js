class JavaScriptCodeGenerator {
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

    lines.push(`test('${testName}', async ({ page }) => {`);

    if (url) {
      lines.push(`  await page.goto('${url}');`);
      lines.push('');
    }

    this.actions.forEach(action => {
      const code = this.generateActionCode(action);
      if (code) {
        lines.push(`  ${code}`);
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

    return lines.join('\n');
  }

  generateImports() {
    const lines = [];
    
    lines.push("const { test, expect } = require('@playwright/test');");
    
    if (this.imports.has('toMatchComponentSnapshot')) {
      lines.push("const { expect: expectWithComponents } = require('./helpers/custom-matchers');");
    }

    return lines.join('\n');
  }

  generateActionCode(action) {
    switch (action.type) {
      case 'goto':
        return `await page.goto('${action.url}');`;
      
      case 'click':
        return `await page.click('${action.selector}');`;
      
      case 'fill':
        return `await page.fill('${action.selector}', '${action.value}');`;
      
      case 'select':
        return `await page.selectOption('${action.selector}', '${action.value}');`;
      
      case 'press':
        return `await page.press('${action.selector}', '${action.key}');`;
      
      case 'check':
        return `await page.check('${action.selector}');`;
      
      case 'uncheck':
        return `await page.uncheck('${action.selector}');`;
      
      default:
        return null;
    }
  }

  generateSnapshotAssertion(selector, data) {
    const lines = [];
    const indent = '  ';
    
    const snapshotLines = data.snapshot.trim().split('\n');
    const formattedSnapshot = snapshotLines
      .map((line, idx) => {
        if (idx === 0) return line;
        return '    ' + line;
      })
      .join('\n');

    lines.push(`${indent}await expect(page.locator('${selector}')).toMatchComponentSnapshot(\``);
    lines.push(`${indent}  ${formattedSnapshot}`);
    lines.push(`${indent}\`);`);

    return lines.join('\n');
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
