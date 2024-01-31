const shell = require('shelljs');

function setupProject() {
  // Install dependencies
  if (shell.exec('npm i').code !== 0) {
    throw new Error('npm install failed');
  }
}

module.exports = setupProject;
