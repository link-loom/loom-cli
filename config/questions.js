const newProject = [
  {
    type: 'input',
    name: 'name',
    message: 'Project name:'
  }
]

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
  }
]

const newApiController = [
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
    name: 'action',
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

module.exports = {
  newProject,
  newView,
  newApiController,
  typeOfProject
}
