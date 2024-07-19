#! /usr/bin/env ts-node

import inquirer from 'inquirer';
import chalk from 'chalk';

import teamInfo from '../data/testTeamInfo.js';
import actionSelect from '../components/actionSelect.js';
import team from './team.js';
import channelsList from './channelsList.js';
import usersList from './users.js';
import rolesList from './rolesList.js';
import figlet from 'figlet';

const interactive = async () => {
  console.log(chalk.magentaBright.bold.underline("Quiet Sandbox"));
  console.log("Navigate options with arrow keys, use E to select, and Q to go back.");
  let exit = false;
  while (exit === false) {
    const answer = await actionSelect(
        {
          message: chalk.bold("Main Menu"),
          choices: [
            { name: "Team", value: "team", description: "Explore team information"},
            { name: "Channels", value: "channels", description: "Explore channels" },
            { name: "Users", value: "users", description: "Explore users" },
            { name: "Roles", value: "roles", description: "Explore roles" },
            { name: "Invites", value: "invites", description: "Explore invites" },
          ],
          actions: [
            { name: "Select", value: "select", key: "e" },
            { name: "Exit Program", value: "exit", key: "escape" },
          ]
        },
      )
    switch (answer.action) {
      case "select":
      case undefined: // catches enter/return key
        switch (answer.answer) {
          case "team":
            team();
            break;
          case "channels":
            await channelsList();
            break;
          case "users":
            await usersList();
            break;
          case "roles":
            await rolesList();
            break;
          case "invites":
            console.table(teamInfo.invites);
            break;
        }
        break;
      case "exit":
        exit = true;
        break;
    }
  };
  console.log(chalk.magentaBright.bold("Goodbye!"));
};

export default interactive;
