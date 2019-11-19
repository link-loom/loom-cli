function structure () {
  const finder = require('./finder')
  const { fileStructure } = require('./../config/structure')

  const isBeatFolder = () => {
    var preserveCoreStructure = coreStructure()

    if (preserveCoreStructure === true) {
      return true
    }

    return false
  }

  const coreStructure = async () => {
    try {
      const currentDir = process.cwd()
      const coreFiles = await finder.getFiles(currentDir + '\\src\\core')
      let match = 0

      if (!coreFiles) {
        return false
      }

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
    } catch (e) {
      return false
    }
  }

  return {
    isBeatFolder,
    filesStructure: coreStructure
  }
}

module.exports = structure
