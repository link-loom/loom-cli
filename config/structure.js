const originalFolderStructure = {
  'firstLevel': [
    'config',
    'public',
    'src'
  ],
  'srcLevel': [
    'controllers',
    'core',
    'routes',
    'views'
  ],
  'routesLevel': [
    'api',
    'definition',
    'frontend'
  ]
}

const fileStructure = {
  'core': [
    'apiManager.js',
    'console.js',
    'databaseManager.js',
    'dependencies.js',
    'firebaseManager.js',
    'frontendManager.js',
    'server.js',
    'settings.js',
    'utilities.js'
  ]
}

module.exports = {
  originalFolderStructure,
  fileStructure
}
