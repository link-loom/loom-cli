const replace = require('replace-in-file');
const path = require('path');

function replacePlaceholder(projectName) {
  console.log('Replacing template names...');
  
  const options = {
    // Specify paths to files or use glob patterns
    files: path.resolve(projectName, '**', '*'),
    from: /%LOOM%/g, // RegExp to find the placeholder
    to: projectName, // Replace with the project name
    ignore: [
      // Optionally, specify files to ignore
      path.resolve(projectName, 'node_modules', '**', '*'),
      path.resolve(projectName, '.git', '**', '*')
    ],
  };

  return replace(options)
    .then(results => {
      console.log('Replacement results:', results);
    })
    .catch(error => {
      console.error('Error occurred during replacement:', error);
    });
}

module.exports = replacePlaceholder;
