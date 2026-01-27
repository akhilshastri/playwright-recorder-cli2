const { expect } = require('@playwright/test');
const { AriaSnapshotGenerator } = require('../core/aria-snapshot-generator');
const { SnapshotValidator } = require('./snapshot-validator');

expect.extend({
  async toMatchComponentSnapshot(locator, expectedSnapshot, options = {}) {
    const page = locator.page();
    const selector = await locator.evaluate(el => {
      if (el.id) return `#${el.id}`;
      if (el.className) return `.${el.className.split(' ')[0]}`;
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
        message: () => `Component snapshot matches for ${selector}`,
      };
    } else {
      const diffMessages = result.differences.map(diff => 
        `  ${diff.field}: expected ${JSON.stringify(diff.expected)}, got ${JSON.stringify(diff.actual)}`
      ).join('\n');

      return {
        pass: false,
        message: () => 
          `Component snapshot mismatch for ${selector}:\n${diffMessages}\n\nExpected:\n${expectedSnapshot}\n\nActual:\n${actualSnapshot}`,
      };
    }
  },

  async toHaveComponentAttributes(locator, expectedAttrs) {
    const page = locator.page();
    const selector = await locator.evaluate(el => {
      if (el.id) return `#${el.id}`;
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
        mismatches.push(`Missing attribute: ${key}`);
      } else if (!validator.compareAttributeValues(key, expectedValue, actualAttrs[key])) {
        mismatches.push(
          `${key}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualAttrs[key])}`
        );
      }
    }

    if (mismatches.length === 0) {
      return {
        pass: true,
        message: () => `Component has expected attributes`,
      };
    } else {
      return {
        pass: false,
        message: () => `Component attribute mismatches:\n${mismatches.join('\n')}`,
      };
    }
  },
});

module.exports = { expect };
