#!/usr/bin/env node

const yargs = require('yargs');
const downloadRepo = require('./modules/download');
const replacePlaceholder = require('./modules/replace');
const setupProject = require('./modules/setup');

const argv = yargs
  .command('create', 'Create a new project based on Link Loom boilerplate', {
    name: {
      description: 'project name',
      alias: 'n',
      type: 'string',
    }
  })
  .help()
  .alias('help', 'h')
  .argv;

if (argv._.includes('create') && argv.name) {
  console.log(`Creating project: ${argv.name}`);
  downloadRepo(argv.name)
    .then(() => replacePlaceholder(argv.name))
    .then(() => setupProject(argv.name))
    .then(() => console.log('Project created successfully.'))
    .catch(err => console.error(err));
} else {
  yargs.showHelp();
}
