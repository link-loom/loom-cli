function structure () {
  const finder = require('./finder')
  const { fileStructure } = require('./../config/structure')

  const isBeatFolder = async () => {
    return coreStructure()
  }

  const coreStructure = async () => {
    try {
      const currentDir = process.cwd()
      let match = 0

      for await (const coreFile of finder.getFiles(currentDir + '\\src\\core')) {
        console.log(coreFile)
        fileStructure.core.map((coreFileStructure) => {
          if (coreFile.indexOf(coreFileStructure) > 0) {
            match++
          }
        })
      }

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
