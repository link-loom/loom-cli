const program = require('commander');
const { prompt } = require('inquirer');

const questions = [
  {
    type : 'input',
    name : 'firstname',
    message : 'Enter firstname ...'
  },
  {
    type : 'input',
    name : 'lastname',
    message : 'Enter lastname ...'
  },
  {
    type : 'input',
    name : 'phone',
    message : 'Enter phone number ...'
  },
  {
    type : 'input',
    name : 'email',
    message : 'Enter email address ...'
  }
];

program
  .version('0.0.1')
  .description('Contact management system');

program
  .command('addContact')
  .alias('a')
  .description('Add a contact')
  .action((firstname, lastname, phone, email) => {
    prompt(questions).then(answers =>{
      console.log(answers.firstname)
    });
  });

program
  .command('getContact <name>')
  .alias('r')
  .description('Get contact')
  .action(name => {
    console.log('command');
  });

program.parse(process.argv);

