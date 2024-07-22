import { input, select, number } from '@inquirer/prompts';
import chalk from 'chalk';

import actionSelect from '../components/actionSelect.js';
import teamInfo from '../data/testTeamInfo.js';
import roleSelect from './roleSelect.js';

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
          { name: "Select", value: "select", key: "e" },
          { name: "Back", value: "back", key: "q" },
          { name: "DM", value: "message", key: "m" },
          { name: "Remove User", value: "remove", key: "d" },
          { name: "Set Roles", value: "role", key: "r" },
        ],
      });
    switch (answer.action) {
      case "select":
      case undefined:
        const user = teamInfo.users.find((user) => user.name === answer.answer);
        console.table(user);
        break;
      case "message":
        // TODO: Print dm history
        console.log(chalk.bold(`DM with ${answer.answer}`));
        const msg = await input(
          {
            message: `You to ${answer.answer}:`,
          },
        );
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
        const roles = await roleSelect(answer.answer);
        break;
      case "back":
        exit = true;
        return;
    };
  };
};
