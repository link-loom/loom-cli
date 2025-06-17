const clone = require('git-clone');
const path = require('path');
const { rimraf } = require('rimraf');
const shell = require('shelljs');
const fs = require('fs');

/**
 * Clones a boilerplate repository into a temporary folder,
 * removes any Git history, and moves it into the target project directory.
 *
 * @param {string} projectName - The name of the new project directory.
 * @returns {Promise<void>}
 */
function downloadRepo(projectName) {
  return new Promise((resolve, reject) => {
    // Create a temporary folder to clone into
    const tempPath = path.resolve('temp-' + Math.random().toString(36).substring(2, 15));
    const repo = 'https://github.com/link-loom/loom-svc-js.git';

    // Perform the clone operation
    clone(repo, tempPath, {}, async (err) => {
      if (err) {
        return reject(err);
      }

      try {
        // Remove the .git folder to detach the template from its origin
        const gitDir = path.join(tempPath, '.git');
        if (fs.existsSync(gitDir)) {
          await rimraf(gitDir);
        }

        // Ensure the target project folder exists
        if (!shell.test('-e', projectName)) {
          shell.mkdir(projectName);
        }

        // Move all files, including hidden ones, to the target directory
        shell.mv('-n', `${tempPath}/*`, `${projectName}/`);
        shell.mv('-n', `${tempPath}/.*`, `${projectName}/`);

        // Clean up the temporary folder
        await rimraf(tempPath);

        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

module.exports = downloadRepo;
