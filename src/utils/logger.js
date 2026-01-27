const chalk = require('chalk');

class Logger {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.silent = options.silent || false;
  }

  info(message) {
    if (!this.silent) {
      console.log(chalk.cyan('ℹ'), message);
    }
  }

  success(message) {
    if (!this.silent) {
      console.log(chalk.green('✓'), message);
    }
  }

  warning(message) {
    if (!this.silent) {
      console.log(chalk.yellow('⚠'), message);
    }
  }

  error(message) {
    console.error(chalk.red('✗'), message);
  }

  debug(message) {
    if (this.verbose && !this.silent) {
      console.log(chalk.gray('🐛'), message);
    }
  }

  log(message) {
    if (!this.silent) {
      console.log(message);
    }
  }
}

module.exports = { Logger };
