import inquirer from 'inquirer';
import chalk from 'chalk';

import actionSelect from '../components/actionSelect.js';
import teamInfo from '../data/testTeamInfo.js';

export default async () => {

  let exit = false;
  while (exit === false) {
    let userList = teamInfo.users.map((user) => {
      return {
        name: user.name,
        value: user.name,
      };
    });
    const answer = await actionSelect(
      {
        message: "Select a user",
        choices: userList,
        actions: [
          { name: "View Profile", value: "profile", key: "v" },
          { name: "Direct Message", value: "message", key: "m" },
          { name: "Delete User", value: "remove", key: "d" },
          { name: "Manage Roles", value: "role", key: "r" },
          { name: "Add New User", value: "add", key: "n" },
          { name: "Exit", value: "exit", key: "q" },
        ],
      });
    switch (answer.action) {
      case "profile":
        const user = teamInfo.users.find((user) => user.name === answer.answer);
        console.table(user);
        break;
      case "message":
        // TODO: Print dm history
        console.log(chalk.bold(`DM with ${answer.answer}`));
        const msg = await inquirer.prompt([
          {
            type: "input",
            name: "message",
            message: `You to ${answer.answer}:`,
          },
        ]);
        break;
      case "remove":
        // TODO: replace with middleware
        console.log(chalk.bold(`Removed ${answer.answer}`));
        break;
      case "invite":
        // TODO: replace with middleware
        console.log(chalk.bold("Invite"));
        break;
      case "role":
        // TODO: role assignment dialog
        break;
      case "add":
        // TODO: add new user dialog
        break;
      case "exit":
        exit = true;
        return;
    };
  };
};
