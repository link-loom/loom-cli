const clone = require('git-clone');
const path = require('path');
const { rimraf } = require('rimraf');
const shell = require('shelljs');

function downloadRepo (projectName) {
  return new Promise((resolve, reject) => {
    // Clone into a temporary folder
    const tempPath = path.resolve('temp-' + Math.random().toString(36).substring(2, 15));
    const repo = 'https://github.com/link-loom/loom-svc-js.git'; // Your repository URL

    clone(repo, tempPath, {}, err => {
      if (err) {
        reject(err);
      } else {
        // Check if the projectName directory exists, create if it doesn't
        if (!shell.test('-e', projectName)) {
          shell.mkdir(projectName);
        }

        // Move files from the temp folder to the project folder
        shell.mv('-n', `${tempPath}/*`, `${projectName}/`);
        shell.mv('-n', `${tempPath}/.*`, `${projectName}/`); // Includes hidden files
        rimraf(tempPath).then(resolve).catch(reject); // Delete the temp folder
      }
    });
  });
}

module.exports = downloadRepo;
