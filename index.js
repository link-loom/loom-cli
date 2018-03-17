#!/usr/bin/env node

const program = require('commander');
const { prompt } = require('inquirer');
const finder = require('fs-finder');
const fs = require('fs');
const download = require('download-git-repo');

const originalFolderStructure = {
  'firstLevel': [
    'config',
    'public',
    'src'
  ],
  'srcLevel': [
    'controllers',
    'manage',
    'routes',
    'views'
  ],
  'routesLevel': [
    'api',
    'frontend'
  ]
};

const fileStructure = {
  'controllers': ['mainController.js'],
  'manage': [
    'components.js',
    'dependencies.js',
    'server.js',
    'settings.js',
    'utilities.js'
  ]
}

const newProject = [
  {
    type: 'input',
    name: 'name',
    message: 'Project name:'
  },
];

const newView = [
  {
    type: 'input',
    name: 'name',
    message: 'View name:'
  },
  {
    type: 'input',
    name: 'route',
    message: 'Route (Express notation starting with /):'
  },
  {
    type: 'input',
    name: 'action',
    message: 'Action (name of function in controller):'
  },
];

const newApiController = [
  {
    type: 'input',
    name: 'name',
    message: 'Controller name: '
  },
  {
    type: 'input',
    name: 'route',
    message: 'Route (Express notation starting with /):'
  },
  {
    type: 'input',
    name: 'action',
    message: 'Action (name of function in controller):'
  },
  {
    type: 'list',
    name: 'type',
    message: 'Method:',
    choices: [
      'GET',
      'POST'
    ]
  },
]

const typeOfProject = [
  {
    type: 'list',
    name: 'type',
    message: 'What type of project',
    choices: [
      'Project',
      'View',
      'API Controller'
    ]
  }
]

program
  .version('0.0.1')
  .description('Contact management system');

program
  .command('new')
  .alias('n')
  .action(() => {
    prompt(typeOfProject).then(choise => {
      switch (choise.type.toLocaleLowerCase()) {
        case 'project':
          prompt(newProject).then(answers => {
            createNewProject(answers);
          });
          break;
        case 'view':
          prompt(newView).then(answers => {
            createNewView(answers);
          });
          break;
        case 'api controller':
          prompt(newApiController).then(answers => {
            createNewAPIController(answers);
          });
          break;
        default:
          break;
      }


    });
  });

program
  .command('new <type>')
  .description('New project')
  .action(() => {
    prompt(newProject).then(answers =>
      console.log(answers));
  });

program
  .command('new <type> <name>')
  .option('-f, --firebase')
  .option('-a, --api')
  .option('-w, -web')
  .description('New project')
  .action((type, name, flags) => {
    console.log(flags.firebase)
  });

program.parse(process.argv);

function createNewProject(data) {
  if (isBeatFolder() === false) {
    downloadProjectTemplate(data);
  }
  else {
    console.log('Sorry, can\'t install Beat because current folder looks like a Beat Project');
  }
}

function createNewView(data) {
  if (isBeatFolder() === true) {
    var lastLine = detectLastComponent(false);

    addComponent(lastLine++, `    { route: '${data.route}', view: '/${data.name}/${data.name}.route', action: '${data.action}' },`);
    console.log(`${data.name} view added succesfuly`);
  }
}

function createNewAPIController(data) {
  if (isBeatFolder() === true) {
    var lastLine = detectLastComponent(true);

    addComponent(lastLine++, `    { route: '${data.route}', controller: '/${data.name}/${data.name}.route', action: '${data.action}', method: '${data.method}' },`);
    console.log(`${data.name} API controller added succesfuly`);
  }
}

function detectLastComponent(isAPI) {
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

function addComponent(lineNumber, component) {
  let currentDir = process.cwd();

  var data = fs.readFileSync(currentDir + '\\src\\manage\\components.js').toString().split("\n");
  data.splice(lineNumber, 0, component);
  var text = data.join("\n");

  fs.writeFile(currentDir + '\\src\\manage\\components.js', text, function (err) {
    if (err) return console.log(err);
  });
}

function isBeatFolder() {
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
    if(err){
      console.log('Something was wrong while downloading template');
    }
    else{
      console.log('Project created successfully');
    }
  })
}

const setupProject = function (){

}
