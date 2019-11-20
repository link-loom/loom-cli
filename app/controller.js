function appController () {
  const fs = require('fs')
  const download = require('download-git-repo')
  const replace = require('replace-in-file')

  const createNewProject = (data) => {
    downloadProjectTemplate(data)
  }

  const createNewViewRoute = (data) => {
    var lastLine = detectLastComponent(false)

    addComponent(lastLine++, `    { httpRoute: '${data.route}', route: '/routes/frontend/${data.name}/${data.name}.route', handler: '${data.handler}' },`)
    console.log(`${data.name} view added succesfuly`)
  }

  const createNewAPIRoute = (data) => {
    var lastLine = detectLastComponent(true)

    addComponent(lastLine++, `    { httpRoute: '${data.route}', route: '/routes/api/${data.name}/${data.name}.route', handler: '${data.handler}', method: '${data.method}' },`)
    console.log(`${data.name} API controller added succesfuly`)
  }

  const createNewScaffoldedAPIRoute = (data) => {
    // TODO
  }

  const detectLastComponent = (isAPI) => {
    const currentDir = process.cwd()

    const lines = fs.readFileSync(currentDir + '\\src\\routes\\router.js').toString().split('\n')
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

  const addComponent = (lineNumber, component) => {
    const currentDir = process.cwd()

    var data = fs.readFileSync(currentDir + '\\src\\routes\\router.js').toString().split('\n')
    data.splice(lineNumber, 0, component)
    var text = data.join('\n')

    fs.writeFile(currentDir + '\\src\\routes\\router.js', text, (err) => {
      if (err) return console.log(err)
    })
  }

  const downloadProjectTemplate = (data, currentFolder) => {
    console.log('Downloading template project...')
    download('thEpisode/beat', data.name, (err) => {
      if (err) {
        console.log('Something was wrong while downloading template')
      } else {
        setupProject(data)
      }
    })
  }

  const setupProject = async (data) => {
    try {
      console.log('Setting up project...')
      const changes = replaceToken(data)

      if (!changes) {
        console.log('Error occurred')
      }

      console.log('Project created successfully')
    } catch (error) {
      console.error('Error occurred:', error)
    }
  }

  const replaceToken = async (data) => {
    try {
      const options = {
        files: [
          `${data.name}/**/*.js`,
          `${data.name}/**/*.jsx`,
          `${data.name}/**/*.json`
        ],
        from: /%BEAT%/g,
        to: data.name
      }
      const changes = await replace(options)
      return changes
    } catch (error) {
      console.error('Error occurred:', error)
      return null
    }
  }

  return {
    createNewProject,
    createNewViewRoute,
    createNewAPIRoute,
    createNewScaffoldedAPIRoute
  }
}

module.exports = appController
