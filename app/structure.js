function structure() {
  const finder = require('fs-finder')
  const replace = require('replace-in-file');
  const { originalFolderStructure, fileStructure } = require('./../config/structure')

  const isBeatFolder = function () {
    var preserveFolderStructure = folderStructure()
    var preservefilesStructure = filesStructure()

    if (preservefilesStructure === true && preserveFolderStructure === true) {
      return true
    } else {
      return false
    }
  }

  const folderStructure = function () {
    try {
      let currentDir = process.cwd()

      let foldersFirstLevel = finder.in(currentDir).findDirectories()
      let foldersSrcLevel = finder.in(currentDir + '\\src').findDirectories()
      let foldersRoutesLevel = finder.in(currentDir + '\\src\\routes').findDirectories()

      if (foldersFirstLevel && foldersSrcLevel && foldersRoutesLevel) {
        let matchFirst = 0
        let matchSrc = 0
        let matchRoutes = 0

        foldersFirstLevel.map((folder) => {
          originalFolderStructure.firstLevel.map((structureFolder) => {
            if (folder.indexOf(structureFolder) > 0) matchFirst++
          })
        })

        foldersSrcLevel.map((folder) => {
          originalFolderStructure.srcLevel.map((structureFolder) => {
            if (folder.indexOf(structureFolder) > 0) matchSrc++
          })
        })

        match = 0
        foldersRoutesLevel.map((folder) => {
          originalFolderStructure.routesLevel.map((structureFolder) => {
            if (folder.indexOf(structureFolder)) matchRoutes++
          })
        })

        if ((originalFolderStructure.firstLevel.length >= matchFirst && foldersFirstLevel.length <= matchFirst) ||
          (originalFolderStructure.srcLevel.length >= matchSrc && foldersSrcLevel.length <= matchSrc) ||
          (originalFolderStructure.routesLevel.length >= matchRoutes && foldersRoutesLevel.length <= matchRoutes)) {
          return true
        }
        else {
          return false
        }
      }

      return false
    } catch (e) {
      return false
    }
  }

  const filesStructure = function () {
    try {
      let currentDir = process.cwd()
      let coreFiles = finder.in(currentDir + '\\src\\core').findFiles()

      if (coreFiles) {
        let match = 0

        coreFiles.map((coreFile) => {
          fileStructure.core.map((coreFileStructure) => {
            if (coreFile.indexOf(coreFileStructure) > 0) {
              match++
            }
          })
        })

        if (fileStructure.core.length > match) {
          return false
        }

        return true
      }
    } catch (e) {
      console.log(e);
      return false
    }
  }

  return {
    isBeatFolder,
    folderStructure,
    filesStructure,
  }
}

module.exports = structure
