#!/usr/bin/env node

const program = require('commander');
const { prompt } = require('inquirer');

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
          prompt(newProject).then(answers =>
            console.log(answers));
          break;
        case 'view':
          prompt(newView).then(answers =>
            console.log(answers));
          break;
        case 'api controller':
          prompt(newApiController).then(answers =>
            console.log(answers));
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

