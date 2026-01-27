const fs = require('fs').promises;
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
          console.error(`Failed to update ${snapshot.selector}: ${error.message}`);
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
    
    const escaped = snapshotInfo.snapshot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    const updated = content.replace(regex, newSnapshot);

    await fs.writeFile(snapshotInfo.file, updated, 'utf-8');
  }

  async threeWayMerge(snapshotInfo, newSnapshot) {
    const content = await fs.readFile(snapshotInfo.file, 'utf-8');
    
    const mergeMarker = `<<<<<<< HEAD (current)
${snapshotInfo.snapshot}
=======
${newSnapshot}
>>>>>>> Updated snapshot`;

    const escaped = snapshotInfo.snapshot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    const updated = content.replace(regex, mergeMarker);

    await fs.writeFile(snapshotInfo.file, updated, 'utf-8');
  }

  async createPatch(snapshotInfo, newSnapshot) {
    const oldContent = await fs.readFile(snapshotInfo.file, 'utf-8');
    
    const escaped = snapshotInfo.snapshot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

    const patchFileName = `${path.basename(snapshotInfo.file, '.js')}-${Date.now()}.patch`;
    const patchFilePath = path.join(
      path.dirname(snapshotInfo.file),
      patchFileName
    );

    await fs.writeFile(patchFilePath, patch, 'utf-8');

    return patchFilePath;
  }
}

module.exports = { SnapshotUpdater };
