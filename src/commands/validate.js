const { PlaywrightTestValidator } = require('../validators/playwright-test-validator');
const chalk = require('chalk');
const ora = require('ora');

async function validate(testFilesPattern, options) {
  const spinner = ora('Parsing test files...').start();

  try {
    const validator = new PlaywrightTestValidator({
      strict: options.strict || false,
      arrayMatchMode: options.arrayMatchMode || 'subset',
      countTolerance: parseInt(options.countTolerance) || 0,
      headless: options.headless !== false,
    });

    // Parse test files
    await validator.parseTestFiles(testFilesPattern);
    
    if (validator.snapshots.length === 0) {
      spinner.warn('No snapshots found in test files');
      return;
    }

    spinner.succeed(`Found ${validator.snapshots.length} snapshots`);
    
    const validationSpinner = ora('Validating snapshots...').start();

    // Validate all
    const report = await validator.validateAll(options.baseUrl);

    validationSpinner.stop();

    // Print report
    console.log('');
    validator.printReport();

    // Exit with error if any failed
    if (report.summary.failed > 0) {
      process.exit(1);
    }

  } catch (error) {
    spinner.fail('Validation failed');
    throw error;
  }
}

module.exports = { validate };
