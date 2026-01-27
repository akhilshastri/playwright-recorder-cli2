const fs = require('fs').promises;
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

    console.log(`Found ${this.testFiles.length} test files`);

    for (const file of this.testFiles) {
      await this.parseTestFile(file);
    }
  }

  async parseTestFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    
    const snapshotRegex = /expect\(.*?\.locator\(['"]([^'"]+)['"]\)\)\.toMatchComponentSnapshot\([^`]*\`([^`]*)\`\)/gs;
    
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

    const ariaSnapshotRegex = /expect\(.*?\.locator\(['"]([^'"]+)['"]\)\)\.toMatchAriaSnapshot\([^`]*\`([^`]*)\`\)/gs;
    
    while ((match = ariaSnapshotRegex.exec(content)) !== null) {
      const selector = match[1];
      const snapshot = match[2];
      
      this.snapshots.push({
        file: filePath,
        selector,
        snapshot,
      });
    }

    const snapshotDir = filePath.replace(/\.spec\.(js|ts)$/, '.spec.$1-snapshots');
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
            
            const selectorMatch = file.match(/^(.+?)(?:-\d+)?\.aria\.yml$/);
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
        
        console.log(`Validating: ${snapshot.selector} from ${path.basename(snapshot.file)}`);
        
        try {
          await this.validateSnapshot(
            url,
            snapshot.selector,
            snapshot.snapshot,
            this.options
          );
        } catch (error) {
          console.error(`Failed to validate ${snapshot.selector}: ${error.message}`);
        }
      }

      return this.generateReport();
    } finally {
      await this.close();
    }
  }
}

module.exports = { PlaywrightTestValidator };
