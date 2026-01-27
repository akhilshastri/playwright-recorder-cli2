const { CustomRecorder } = require('../core/recorder-injector');
const chalk = require('chalk');
const ora = require('ora');

async function record(options) {
  const spinner = ora('Initializing recorder...').start();
  
  try {
    const recorder = new CustomRecorder({
      output: options.output,
      browser: options.browser || 'chromium',
      device: options.device,
      viewport: options.viewport ? parseViewport(options.viewport) : null,
      saveSnapshots: options.saveSnapshots,
    });
    
    spinner.succeed('Recorder initialized');
    
    console.log(chalk.cyan('\n📋 Instructions:'));
    console.log(chalk.white('  1. Interact with the page (clicks, fills, navigation)'));
    console.log(chalk.white('  2. Click "📸 Snapshot" to capture standard aria snapshot'));
    console.log(chalk.white('  3. Click "🎯 Component" to capture component with attributes'));
    console.log(chalk.white('  4. Click "💾 Save Test" to save the generated test'));
    console.log(chalk.white('  5. Click "⏹️ Stop" or close browser when done\n'));
    
    console.log(chalk.yellow('💡 Code preview updates in real-time in the recorder UI\n'));
    
    // Start recording
    await recorder.start(options.url);
    
    console.log(chalk.green(`\n✅ Test saved to: ${options.output}`));
    
  } catch (error) {
    spinner.fail('Recording failed');
    throw error;
  }
}

function parseViewport(viewportString) {
  const [width, height] = viewportString.split('x').map(Number);
  if (isNaN(width) || isNaN(height)) {
    throw new Error('Invalid viewport format. Use: 1920x1080');
  }
  return { width, height };
}

module.exports = { record };
