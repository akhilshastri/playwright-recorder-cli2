#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');

// Import commands
const { record } = require('./commands/record');
const { validate } = require('./commands/validate');
const { update } = require('./commands/update');

program
  .name('playwright-recorder')
  .description('Custom Playwright recorder with component snapshot support')
  .version('1.0.0');

// Record command
program
  .command('record')
  .description('Start recording user actions and component snapshots')
  .option('-u, --url <url>', 'Starting URL to navigate to')
  .option('-o, --output <file>', 'Output test file path', './tests/recorded.spec.js')
  .option('--browser <browser>', 'Browser to use (chromium, firefox, webkit)', 'chromium')
  .option('--device <device>', 'Emulate device (iPhone 13, iPad, etc.)')
  .option('--viewport <size>', 'Viewport size (e.g., 1920x1080)')
  .option('--save-snapshots', 'Save snapshots to separate .aria.yml files', false)
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('\n🎬 Playwright Component Recorder\n'));
      console.log(chalk.gray('Record actions and capture component snapshots\n'));
      
      await record(options);
      
      console.log(chalk.green.bold('\n✅ Recording complete!\n'));
    } catch (error) {
      console.error(chalk.red.bold('\n❌ Recording failed:\n'));
      console.error(chalk.red(error.message));
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate [tests...]')
  .description('Validate aria snapshots in test files')
  .option('-b, --base-url <url>', 'Base URL for tests', 'http://localhost:3000')
  .option('-g, --grep <pattern>', 'Only validate tests matching pattern')
  .option('--strict', 'Fail on unexpected attributes', false)
  .option('--headless', 'Run in headless mode', true)
  .option('--array-match-mode <mode>', 'Array matching mode (subset, exact, ordered)', 'subset')
  .option('--count-tolerance <number>', 'Allow variance in count attributes', '0')
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (tests, options) => {
    try {
      console.log(chalk.blue.bold('\n🔍 Validating Component Snapshots\n'));
      
      await validate(tests.length > 0 ? tests.join(',') : 'tests/**/*.spec.js', options);
      
      console.log(chalk.green.bold('\n✅ Validation complete!\n'));
    } catch (error) {
      console.error(chalk.red.bold('\n❌ Validation failed:\n'));
      console.error(chalk.red(error.message));
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Update command
program
  .command('update [tests...]')
  .description('Update aria snapshots')
  .option('-m, --mode <mode>', 'Update mode (all, changed, missing)', 'all')
  .option('--update-source-method <method>', 'Update method (patch, 3way, overwrite)', 'patch')
  .option('-b, --base-url <url>', 'Base URL for tests', 'http://localhost:3000')
  .option('--headless', 'Run in headless mode', true)
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (tests, options) => {
    try {
      console.log(chalk.blue.bold('\n🔄 Updating Component Snapshots\n'));
      
      await update(tests.length > 0 ? tests.join(',') : 'tests/**/*.spec.js', options);
      
      console.log(chalk.green.bold('\n✅ Update complete!\n'));
      
      if (options.updateSourceMethod === 'patch') {
        console.log(chalk.yellow('📝 Review the .patch files and apply with: git apply <file>.patch\n'));
      }
    } catch (error) {
      console.error(chalk.red.bold('\n❌ Update failed:\n'));
      console.error(chalk.red(error.message));
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Capture command (utility)
program
  .command('capture <url>')
  .description('Capture aria snapshot from a URL (utility)')
  .option('-s, --selector <selector>', 'Element selector', 'body')
  .option('-o, --output <file>', 'Output file for snapshot')
  .option('--component', 'Capture as component with attributes', false)
  .option('--include-rows', 'Include sample row data', false)
  .option('--max-rows <number>', 'Maximum rows to include', '3')
  .action(async (url, options) => {
    try {
      const { chromium } = require('playwright');
      const { AriaSnapshotGenerator } = require('./core/aria-snapshot-generator');
      const fs = require('fs').promises;
      
      console.log(chalk.blue(`📸 Capturing snapshot from ${url}...\n`));
      
      const browser = await chromium.launch();
      const page = await browser.newPage();
      await page.goto(url);
      
      const generator = new AriaSnapshotGenerator(page);
      const snapshot = await generator.generateEnhancedSnapshot(options.selector, {
        includeComponentAttrs: options.component,
        includeRowData: options.includeRows,
        maxRows: parseInt(options.maxRows),
      });
      
      if (options.output) {
        await fs.writeFile(options.output, snapshot);
        console.log(chalk.green(`✅ Snapshot saved to ${options.output}`));
      } else {
        console.log(chalk.cyan('\nSnapshot:\n'));
        console.log(snapshot);
      }
      
      await browser.close();
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

// Parse arguments
program.parse();
