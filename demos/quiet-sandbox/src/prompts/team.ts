#! /usr/bin/env ts-node

import chalk from 'chalk';

import teamInfo from '../data/testTeamInfo.js';

const team = () => {

  console.log("--------------------");
  console.log("Team Information");
  console.log("--------------------");
  console.log("Name:", teamInfo.name);
  console.log(chalk.bold("Channels:"));
  console.table(teamInfo.channels);
  console.log("\n");

  console.log(chalk.bold("Users"));
  console.table(teamInfo.users);
  console.log("\n");

  console.log(chalk.bold("Roles"));
  console.table(teamInfo.roles);
  console.log("\n");

  console.log(chalk.bold("Invites"));
  console.table(teamInfo.invites);
  console.log("\n");

}

export default team;
