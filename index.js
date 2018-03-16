#!/usr/bin/env node

const program = require('commander');
const { prompt } = require('inquirer');
const finder = require('fs-finder');
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
  'manage':[
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
  {
    type: 'confirm',
    name: 'firebase',
    message: 'Do you want to use firebase? Y/n: '
  },
  {
    type: 'confirm',
    name: 'api',
    message: 'Want to use Web API? Y/n: '
  },
  {
    type: 'confirm',
    name: 'frontend',
    message: 'Want to use a Frontend? Y/n:'
  }
];

const newView = [
  {
    type: 'input',
    name: 'name',
    message: 'View name: '
  },
];

const newApiController = [
  {
    type: 'input',
    name: 'name',
    message: 'Controller name: '
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
          prompt(newView).then(answers =>{
            createNewView(answers);
          });
          break;
        case 'api controller':
          prompt(newApiController).then(answers =>{
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
  if(isBeatFolder() === false){

  }
}

function createNewView(data) {
  if(isBeatFolder() === false){
    
  }
}

function createNewAPIController(data) {
  if(isBeatFolder() === false){
    
  }
}

function isBeatFolder() {
  var preserveFolderStructure = folderStructure();
  var preservefilesStructure = filesStructure();

  if(preservefilesStructure === true && preserveFolderStructure === true){
    return true;
  }
  else{
    return false;
  }
}

const folderStructure = function () {
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
        if (folder.indexOf(structureFolder)>0) match++;
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
};

const filesStructure = function(){
  let currentDir = process.cwd();
  let manageFiles = finder.in(currentDir + '\\src\\manage').findFiles();

  if(manageFiles){
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
  
}
