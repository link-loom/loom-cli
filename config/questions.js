const newProjectQuestions = [
  {
    type: 'input',
    name: 'name',
    message: 'Project name:'
  }
]

const newViewRouteQuestions = [
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
    name: 'handler',
    message: 'Function handler (name of function in controller):'
  }
]

const newApiRouteQuestions = [
  {
    type: 'input',
    name: 'name',
    message: 'Controller name (without .js extension): '
  },
  {
    type: 'input',
    name: 'route',
    message: 'API Route (Express notation starting with /):'
  },
  {
    type: 'input',
    name: 'handler',
    message: 'Function handler (name of function in controller):'
  },
  {
    type: 'list',
    name: 'method',
    message: 'Method:',
    choices: [
      'GET',
      'POST'
    ]
  }
]

const optionsOfNewQuestions = [
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

const isScaffolded = [
  {
    type: 'list',
    name: 'isScaffolded',
    message: 'Is scaffolded? (CRUD operations)',
    choices: [
      'Yes',
      'No'
    ]
  }
]

module.exports = {
  newProjectQuestions,
  newViewRouteQuestions,
  newApiRouteQuestions,
  optionsOfNewQuestions
}
