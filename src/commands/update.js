const { PlaywrightTestValidator } = require('../validators/playwright-test-validator');
const { SnapshotUpdater } = require('../core/snapshot-updater');
const chalk = require('chalk');
const ora = require('ora');

async function update(testFilesPattern, options) {
  const spinner = ora('Parsing test files...').start();

  try {
    const validator = new PlaywrightTestValidator({
      headless: options.headless !== false,
    });

    // Parse test files
    await validator.parseTestFiles(testFilesPattern);
    
    if (validator.snapshots.length === 0) {
      spinner.warn('No snapshots found in test files');
      return;
    }

    spinner.succeed(`Found ${validator.snapshots.length} snapshots to update`);
    
    const updateSpinner = ora('Updating snapshots...').start();

    // Create updater
    const updater = new SnapshotUpdater({
      mode: options.mode,
      updateSourceMethod: options.updateSourceMethod,
      baseUrl: options.baseUrl,
    });

    // Update all snapshots
    const results = await updater.updateSnapshots(validator.snapshots);

    updateSpinner.succeed(`Updated ${results.updated} snapshots`);

    // Print summary
    console.log('');
    console.log(chalk.cyan('📊 Update Summary:'));
    console.log(chalk.white(`  Total: ${results.total}`));
    console.log(chalk.green(`  Updated: ${results.updated}`));
    console.log(chalk.yellow(`  Skipped: ${results.skipped}`));
    console.log(chalk.red(`  Failed: ${results.failed}`));

    if (results.patchFiles && results.patchFiles.length > 0) {
      console.log('');
      console.log(chalk.cyan('📝 Patch files created:'));
      results.patchFiles.forEach(file => {
        console.log(chalk.white(`  - ${file}`));
      });
    }

  } catch (error) {
    spinner.fail('Update failed');
    throw error;
  }
}

module.exports = { update };
