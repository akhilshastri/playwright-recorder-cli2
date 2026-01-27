const fs = require('fs');
const path = require('path');

class Config {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    const configPaths = [
      path.join(process.cwd(), 'playwright-recorder.config.js'),
      path.join(process.cwd(), 'playwright-recorder.config.json'),
    ];

    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        try {
          const config = require(configPath);
          console.log(`Loaded config from: ${configPath}`);
          return config;
        } catch (error) {
          console.error(`Failed to load config from ${configPath}:`, error.message);
        }
      }
    }

    return this.getDefaultConfig();
  }

  getDefaultConfig() {
    return {
      validation: {
        strict: false,
        arrayMatchMode: 'subset',
        countTolerance: 0,
      },
      components: {
        grid: {
          requiredAttributes: ['row-count', 'column-count'],
        },
        table: {
          requiredAttributes: ['row-count', 'headers'],
        },
      },
      recording: {
        defaultBrowser: 'chromium',
        defaultOutput: './tests/recorded.spec.js',
        saveSnapshots: false,
      },
    };
  }

  get(key, defaultValue = null) {
    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }

    return value !== undefined ? value : defaultValue;
  }
}

module.exports = { Config };
