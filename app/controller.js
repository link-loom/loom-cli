function appController(){
  const createNewProject = function (data) {
    if (isBeatFolder() === false) {
      downloadProjectTemplate(data);
    }
    else {
      console.log('Sorry, can\'t install Beat because current folder looks like a Beat Project');
    }
  }
  
  const createNewView = function (data) {
    if (isBeatFolder() === true) {
      var lastLine = detectLastComponent(false);
  
      addComponent(lastLine++, `    { route: '${data.route}', view: '/${data.name}/${data.name}.route', action: '${data.action}' },`);
      console.log(`${data.name} view added succesfuly`);
    }
    else{
      console.log(`This folder does not has a beat folder structure project`)
    }
  }
  
  const createNewAPIController = function (data) {
    if (isBeatFolder() === true) {
      var lastLine = detectLastComponent(true);
  
      addComponent(lastLine++, `    { route: '${data.route}', controller: '/${data.name}/${data.name}.route', action: '${data.action}', method: '${data.method}' },`);
      console.log(`${data.name} API controller added succesfuly`);
    }
    else{
      console.log(`This folder does not has a beat folder structure project`)
    }
  }
  
  const detectLastComponent = function (isAPI) {
    let currentDir = process.cwd();
  
    let lines = fs.readFileSync(currentDir + '\\src\\manage\\components.js').toString().split("\n");
    let lastComponentLine = 0;
    let startLine = false;
    let token = '';
  
    if (isAPI) {
      token = 'apiComponents:';
    }
    else {
      token = 'frontendComponents:';
    }
  
    for (let i = 0; i < lines.length; i++) {
      var line = lines[i];
  
      if (line.indexOf(token) > 0 && startLine === false) {
        startLine = true;
      }
      else if (line.indexOf('route') > 0 && startLine === true) {
        lastComponentLine = i;
      }
      else if (line.indexOf(']') && startLine === true) {
        break;
      }
    }
    return ++lastComponentLine;
  }
  
  const addComponent = function (lineNumber, component) {
    let currentDir = process.cwd();
  
    var data = fs.readFileSync(currentDir + '\\src\\manage\\components.js').toString().split("\n");
    data.splice(lineNumber, 0, component);
    var text = data.join("\n");
  
    fs.writeFile(currentDir + '\\src\\manage\\components.js', text, function (err) {
      if (err) return console.log(err);
    });
  }
  
  const isBeatFolder = function () {
    var preserveFolderStructure = folderStructure();
    var preservefilesStructure = filesStructure();
  
    if (preservefilesStructure === true && preserveFolderStructure === true) {
      return true;
    }
    else {
      return false;
    }
  }
  
  const folderStructure = function () {
    try {
      let currentDir = process.cwd();
  
      let foldersFirstLevel = finder.in(currentDir).findDirectories();
      let foldersSrcLevel = finder.in(currentDir + '\\src').findDirectories();
      let foldersRoutesLevel = finder.in(currentDir + '\\src\\routes').findDirectories();
  
      if (foldersFirstLevel && foldersSrcLevel && foldersRoutesLevel) {
        let preserveFirstLevel = false;
        let preserveSrcLevel = false;
        let preserveRoutesLevel = false;
        let match = 0;
  
        foldersFirstLevel.map((folder) => {
          originalFolderStructure.firstLevel.map((structureFolder) => {
            if (folder.indexOf(structureFolder) > 0) match++;
          })
        })
  
        if (originalFolderStructure.firstLevel.length > match) {
          return false;
        }
  
        match = 0;
        foldersSrcLevel.map((folder) => {
          originalFolderStructure.srcLevel.map((structureFolder) => {
            if (folder.indexOf(structureFolder) > 0) match++;
          })
        })
  
        if (originalFolderStructure.srcLevel.length > match) {
          return false;
        }
  
        match = 0;
        foldersRoutesLevel.map((folder) => {
          originalFolderStructure.routesLevel.map((structureFolder) => {
            if (folder.indexOf(structureFolder)) match++;
          })
        })
  
        if (originalFolderStructure.routesLevel.length > match) {
          return false;
        }
  
        return true;
      }
  
      return false;
    } catch (e) {
      return false;
    }
  
  };
  
  const filesStructure = function () {
    try {
      let currentDir = process.cwd();
      let manageFiles = finder.in(currentDir + '\\src\\manage').findFiles();
  
      if (manageFiles) {
        let preserveManageFiles = false;
        let preserveControllersFiles = false;
        let match = 0;
  
        manageFiles.map((manageFile) => {
          fileStructure.manage.map((manageFileStructure) => {
            if (manageFile.indexOf(manageFileStructure) > 0) match++;
          })
        })
  
        if (fileStructure.manage.length > match) {
          return false;
        }
  
        return true;
      }
    } catch (e) {
      return false;
    }
  }
  
  const createDefaultFolder = function () {
    let dir = './beat'
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    else {
      console.log('Current folder contains a folder named "beat"');
    }
  }
  
  const downloadProjectTemplate = function (data, currentFolder) {
    console.log('Downloading template project...');
    download('thEpisode/beat', data.name, function (err) {
      if (err) {
        console.log('Something was wrong while downloading template');
      }
      else {
        console.log('Project created successfully');
      }
    })
  }
  
  const setupProject = function () {
  
  }

  return {
    createNewProject,
    createNewView,
    createNewAPIController
  }

}

module.exports = appController;
