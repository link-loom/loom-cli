function appController() {
  const finder = require('fs-finder')
  const fs = require('fs')
  const download = require('download-git-repo')
  const replace = require('replace-in-file');
  const structure = require('./structure')()

  const createNewProject = function (data) {
    downloadProjectTemplate(data)
  }

  const createNewView = function (data) {
    var lastLine = detectLastComponent(false)

    addComponent(lastLine++, `    { httpRoute: '${data.route}', route: '/routes/frontend/${data.name}/${data.name}.route', handler: '${data.handler}' },`)
    console.log(`${data.name} view added succesfuly`)
  }

  const createNewAPIController = function (data) {
    var lastLine = detectLastComponent(true)

    addComponent(lastLine++, `    { httRoute: '${data.route}', route: '/routes/api/${data.handler}/${data.handler}.route', handler: '${data.handler}', method: '${data.method}' },`)
    console.log(`${data.name} API controller added succesfuly`)
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
