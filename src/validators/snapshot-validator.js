const { chromium } = require('playwright');
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
    const lines = snapshotString.trim().split('\n');
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

      const mainLineMatch = trimmed.match(/^-\s+(\w+)(?:\s+"([^"]*)")?(?:\s+\[([^\]]+)\])?/);
      
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
    const attrRegex = /(\w+(?:-\w+)*)=(?:"([^"]*)"|(\[[^\]]*\])|(\w+))/g;
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
        console.warn(`Invalid regex pattern: ${pattern}`);
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
    
    console.log('\n' + chalk.bold('📊 Validation Report'));
    console.log(chalk.gray('='.repeat(60)));
    
    console.log(chalk.cyan(`Total Snapshots: ${report.summary.total}`));
    console.log(chalk.green(`✓ Passed: ${report.summary.passed}`));
    console.log(chalk.red(`✗ Failed: ${report.summary.failed}`));
    console.log(chalk.blue(`Pass Rate: ${report.summary.passRate}`));
    
    console.log('\n' + chalk.bold('Details:'));
    console.log(chalk.gray('='.repeat(60)));

    this.results.forEach((result, idx) => {
      const status = result.passed ? chalk.green('✓ PASS') : chalk.red('✗ FAIL');
      console.log(`\n${idx + 1}. ${status} ${chalk.cyan(result.selector)}`);
      console.log(chalk.gray(`   URL: ${result.url}`));

      if (!result.passed && result.differences) {
        result.differences.forEach(diff => {
          const icon = diff.severity === 'error' ? '❌' : 
                      diff.severity === 'warning' ? '⚠️' : 'ℹ️';
          
          console.log(`   ${icon} ${chalk.yellow(diff.type)}: ${diff.field}`);
          console.log(`      Expected: ${chalk.green(JSON.stringify(diff.expected))}`);
          console.log(`      Actual:   ${chalk.red(JSON.stringify(diff.actual))}`);
        });
      }

      if (result.error) {
        console.log(chalk.red(`   Error: ${result.error}`));
      }
    });

    console.log('\n' + chalk.gray('='.repeat(60)) + '\n');
  }
}

module.exports = { SnapshotValidator };
