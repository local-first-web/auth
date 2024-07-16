#! /usr/bin/env ts-node

import inquirer from "inquirer";
import chalk from "chalk";

import teamInfo from "../data/testTeamInfo";
import team from "./team";
import channelsList from "./channelsList";
import usersList from "./usersList";

const interactive = async () => {
  console.log(chalk.bold("Welcome to the Quiet Sandbox!"));
  console.log(chalk.bold("What would you like to do?"));
  let exit = false;
  while (exit === false) {
    const answer = await inquirer.prompt([
        {
          type: "select",
          name: "action",
          message: "",
          choices: [
            { name: "Team", value: "team", description: "Explore team information"},
            { name: "Channels", value: "channels", description: "Explore channels" },
            { name: "Users", value: "users", description: "Explore users" },
            { name: "Roles", value: "roles", description: "Explore roles" },
            { name: "Invites", value: "invites", description: "Explore invites" },
            { name: "Exit", value: "exit", description: "Exit the program" },
          ],
        },
      ])
    switch (answer.action) {
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
        console.table(teamInfo.roles);
        break;
      case "invites":
        console.table(teamInfo.invites);
        break;
      case "exit":
        console.log(chalk.bold("Goodbye!"));
        exit = true;
        break;
    }
  };
};

export default interactive;
