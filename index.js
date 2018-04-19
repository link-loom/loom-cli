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

program
  .version('0.0.1')
  .description('Beat CLI')

program
  .command('new-project')
  .action(() => {
    prompt(newProject).then(answers => {
      app.createNewProject(answers)
    })
  })

program
  .command('new-view')
  .action(() => {
    prompt(newView).then(answers => {
      app.createNewView(answers)
    })
  })

program
  .command('new-api')
  .action(() => {
    prompt(newApiController).then(answers => {
      app.createNewAPIController(answers)
    })
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
