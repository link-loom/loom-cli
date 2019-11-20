#!/usr/bin/env node

const program = require('commander')
const { prompt } = require('inquirer')

const {
  newViewRouteQuestions,
  newApiRouteQuestions,
  optionsOfNewQuestions,
  newApiRouteScaffoldedQuestions,
  isScaffolded
} = require('./config/questions')

const app = require('./app/controller')()
const structure = require('./app/structure')()

program
  .version('1.2.2', '-v, --version')
  .description('Beat CLI')

program
  .command('new-project <name>')
  .description('Create a new project with Beat template')
  .action((name) => {
    if (structure.isBeatFolder()) {
      console.log('Sorry, can\'t install Beat because current folder looks like a Beat Project')
      return
    }

    app.createNewProject(name)
  })

program
  .command('new-view-route')
  .action(() => {
    if (structure.isBeatFolder() === true) {
      prompt(newViewRouteQuestions).then(answers => {
        app.createNewViewRoute(answers)
      })
    } else {
      console.log('This folder does not has a beat folder structure project')
    }
  })

program
  .command('new-api-route')
  .action(() => {
    if (structure.isBeatFolder() === true) {
      prompt(isScaffolded).then(isScaffoldedAnswer => {
        if (isScaffoldedAnswer.isScaffolded) {
          prompt(newApiRouteScaffoldedQuestions).then(answers => {
            app.createNewScaffoldedAPIRoute(answers)
          })
        } else {
          prompt(newApiRouteQuestions).then(answers => {
            app.createNewAPIRoute(answers)
          })
        }
      })
    } else {
      console.log('This folder does not has a beat folder structure project')
    }
  })

program
  .command('new <name>')
  .action((name) => {
    prompt(optionsOfNewQuestions).then(choise => {
      switch (choise.type.toLocaleLowerCase()) {
        case 'project':
          app.createNewProject(name)
          break
        case 'view':
          prompt(newViewRouteQuestions).then(answers => {
            app.createNewViewRoute(answers)
          })
          break
        case 'api controller':
          prompt(newApiRouteQuestions).then(answers => {
            app.createNewAPIRoute(answers)
          })
          break
        default:
          console.log('Please choose a valid option')
          break
      }
    })
  })

program.parse(process.argv)

if (!program.args.length) program.help()
