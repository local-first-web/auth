#! /usr/bin/env ts-node

import chalk from 'chalk';
import { confirm, input } from '@inquirer/prompts';

import { SigChain } from '../auth/chain.js';
import { Storage } from '../network.js';
import { UserService } from '../auth/services/members/userService.js';

const teamInfo = (storage: Storage) => {
  if (storage.getContext() == null || storage.getSigChain() == null) {
    console.log("Must set the user context and sig chain to display team information")
    return
  }

  const sigChain = storage.getSigChain()!
  const context = storage.getContext()!

  console.log("--------------------");
  console.log("Team Information");
  console.log("--------------------");
  console.log("Name:", sigChain.team.teamName);
  console.log(chalk.bold("Channels:"));
  console.table(sigChain.channels.getAllChannels());
  console.log("\n");

  console.log(chalk.bold("Users"));
  console.table(sigChain.users.getAllMembers());
  console.log("\n");

  console.log(chalk.bold("Roles"));
  console.table(sigChain.roles.getAllRoles());
  console.log("\n");

  console.log("\n--------------------");
  console.log("User Information");
  console.log("--------------------");
  console.log("Name:", context.user.userName);
  console.log("ID:", context.user.userId);
  console.log(chalk.bold("Device"));
  console.log("Name:", context.device.deviceName)
  console.log("ID:", context.device.deviceId)
  console.log("\n");

  // console.log(chalk.bold("Invites"));
  // console.table(sigChain.invites.getAllInvites());
  // console.log("\n");

}

const teamAdd = async (storage: Storage) => {
  if (storage.getContext()) {
    console.warn("Already setup team")
    return storage
  }

  const isNewTeam = await confirm({
    message: "Is this a new team?",
    default: true
  });

  if (isNewTeam) {
    const teamName = await input({
      message: "What is your team name?",
      default: 'quiet',
    });
    const username = await input({
      message: "What is your username?",
      default: 'founder'
    });
    console.log(`Creating new team with name ${teamName} and founding user ${username}`);
    const loadedSigChain = SigChain.create(teamName, username);
    storage.setContext(loadedSigChain.context)
    storage.setSigChain(loadedSigChain.sigChain)
    storage.setAuthContext({
      user: loadedSigChain.context.user,
      device: loadedSigChain.context.device,
      team: loadedSigChain.sigChain.team
    })
  } else {
    const username = await input({
      message: "What is your username?",
      default: 'otheruser'
    });
    const inviteSeed = await input({
      message: "What is your invite seed?",
      validate: ((input) => {
        return input != null ? true : "Must enter a valid invite seed"
      })
    })
    console.log(`Joining a team as user ${username} with invite seed ${inviteSeed}`);
    const prospectiveUser = UserService.createFromInviteSeed(username, inviteSeed)
    storage.setContext(prospectiveUser.context)
  }
  
  return storage
}

export {
  teamInfo,
  teamAdd,
}
