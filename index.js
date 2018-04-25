#!/usr/bin/env node

const program = require('commander')
const { prompt } = require('inquirer')

const {
  newProject,
  newView,
  newApiController,
  typeOfProject
} = require('./config/questions')

const app = require('./app/controller')()
const structure = require('./app/structure')()

program
  .version('1.0.8', '-v, --version')
  .description('Beat CLI')

program
  .command('new-project')
  .action(() => {
    if (structure.isBeatFolder() === false) {
      prompt(newProject).then(answers => {
        app.createNewProject(answers)
      })
    }
    else {
      console.log('Sorry, can\'t install Beat because current folder looks like a Beat Project')
    }
  })

program
  .command('new-view-route')
  .action(() => {
    if (structure.isBeatFolder() === true) {
      prompt(newView).then(answers => {
        app.createNewView(answers)
      })
    }
    else {
      console.log(`This folder does not has a beat folder structure project`)
    }
  })

program
  .command('new-api-route')
  .action(() => {
    if (structure.isBeatFolder() === true) {
      prompt(newApiController).then(answers => {
        app.createNewAPIController(answers)
      })
    }
    else {
      console.log(`This folder does not has a beat folder structure project`)
    }
  })

program
  .command('new')
  .action(() => {
    prompt(typeOfProject).then(choise => {
      switch (choise.type.toLocaleLowerCase()) {
        case 'project':
          prompt(newProject).then(answers => {
            app.createNewProject(answers)
          })
          break
        case 'view':
          prompt(newView).then(answers => {
            app.createNewView(answers)
          })
          break
        case 'api controller':
          prompt(newApiController).then(answers => {
            app.createNewAPIController(answers)
          })
          break
        default:
          console.log('Please choos a valid option')
          break
      }
    })
  })

program.parse(process.argv)

if (!program.args.length) program.help();
