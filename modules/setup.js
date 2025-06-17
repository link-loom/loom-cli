const shell = require('shelljs');

/**
 * Runs `npm install` inside the newly created project directory.
 *
 * @param {string} projectName - The name of the project folder to enter.
 */
function setupProject(projectName) {
  console.log('Setting up project...');

  // Change directory into the new project
  if (shell.cd(projectName).code !== 0) {
    throw new Error(`Failed to enter directory: ${projectName}`);
  }

  // Run npm install
  if (shell.exec('npm i').code !== 0) {
    throw new Error('npm install failed');
  }
}

module.exports = setupProject;
