const shell = require('shelljs');

function setupProject() {
  console.log('Setting up project...');
  // Install dependencies
  if (shell.exec('npm i').code !== 0) {
    throw new Error('npm install failed');
  }
}

module.exports = setupProject;
