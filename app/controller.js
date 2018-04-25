function appController() {
  const finder = require('fs-finder')
  const fs = require('fs')
  const download = require('download-git-repo')
  const replace = require('replace-in-file');
  const { originalFolderStructure, fileStructure } = require('./../config/structure')

  const createNewProject = function (data) {
    if (isBeatFolder() === false) {
      downloadProjectTemplate(data)
    } else {
      console.log('Sorry, can\'t install Beat because current folder looks like a Beat Project')
    }
  }

  const createNewView = function (data) {
    if (isBeatFolder() === true) {
      var lastLine = detectLastComponent(false)

      addComponent(lastLine++, `    { route: '${data.route}', view: '/${data.name}/${data.name}.route', action: '${data.action}' },`)
      console.log(`${data.name} view added succesfuly`)
    } else {
      console.log(`This folder does not has a beat folder structure project`)
    }
  }

  const createNewAPIController = function (data) {
    if (isBeatFolder() === true) {
      var lastLine = detectLastComponent(true)

      addComponent(lastLine++, `    { route: '${data.route}', controller: '/${data.name}/${data.name}.route', action: '${data.action}', method: '${data.method}' },`)
      console.log(`${data.name} API controller added succesfuly`)
    } else {
      console.log(`This folder does not has a beat folder structure project`)
    }
  }

  const detectLastComponent = function (isAPI) {
    let currentDir = process.cwd()

    let lines = fs.readFileSync(currentDir + '\\src\\routes\\router.js').toString().split('\n')
    let lastComponentLine = 0
    let startLine = false
    let token = ''

    if (isAPI) {
      token = 'api:'
    } else {
      token = 'frontend:'
    }

    for (let i = 0; i < lines.length; i++) {
      var line = lines[i]

      if (line.indexOf(token) > 0 && startLine === false) {
        startLine = true
      } else if (line.indexOf('route') > 0 && startLine === true) {
        lastComponentLine = i
      } else if (line.indexOf(']') && startLine === true) {
        break
      }
    }
    return ++lastComponentLine
  }

  const addComponent = function (lineNumber, component) {
    let currentDir = process.cwd()

    var data = fs.readFileSync(currentDir + '\\src\\routes\\router.js').toString().split('\n')
    data.splice(lineNumber, 0, component)
    var text = data.join('\n')

    fs.writeFile(currentDir + '\\src\\routes\\router.js', text, function (err) {
      if (err) return console.log(err)
    })
  }

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

  const downloadProjectTemplate = function (data, currentFolder) {
    console.log('Downloading template project...')
    download('thEpisode/beat', data.name, function (err) {
      if (err) {
        console.log('Something was wrong while downloading template')
      } else {
        setupProject(data)
      }
    })
  }

  const setupProject = async function (data) {
    try {
      console.log(`Setting up project...`)
      let changes = replaceToken(data)

      if (changes) {
        console.log('Project created successfully')
      }
    }
    catch (error) {
      console.error('Error occurred:', error);
    }
  }

  const replaceToken = async function (data) {
    const options = {
      files: [
        `${data.name}/**/*.js`,
        `${data.name}/**/*.jsx`,
        `${data.name}/**/*.json`,
      ],
      from: /%BEAT%/g,
      to: data.name,
    };
    const changes = await replace(options)
    return changes
  }

  return {
    createNewProject,
    createNewView,
    createNewAPIController
  }
}

module.exports = appController
