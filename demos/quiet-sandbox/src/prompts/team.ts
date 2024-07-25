#! /usr/bin/env ts-node

import chalk from 'chalk';
import { confirm, input } from '@inquirer/prompts';

import { SigChain } from '../auth/chain.js';
import { Libp2pService, Storage } from '../network.js';
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

const teamAdd = async (storage: Storage, existingPeer?: Libp2pService): Promise<Libp2pService> => {
  if (storage.getContext()) {
    console.warn("Already setup team")
    if (existingPeer == null) {
      throw new Error("Already setup team context but no libp2p service was found!  Something very bad happened!")
    }
    return existingPeer
  }

  const isNewTeam = await confirm({
    message: "Is this a new team?",
    default: true
  });

  let peer: Libp2pService

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
    peer = new Libp2pService(loadedSigChain.context.user.userId, storage)
  } else {
    const username = await input({
      message: "What is your username?",
      default: 'otheruser'
    });
    const invitationSeed = await input({
      message: "What is your invite seed?",
      validate: ((input) => {
        return input != null ? true : "Must enter a valid invite seed"
      })
    })
    console.log(`Joining a team as user ${username} with invite seed ${invitationSeed}`);
    const prospectiveUser = UserService.createFromInviteSeed(username, invitationSeed)
    storage.setContext(prospectiveUser.context)
    storage.setAuthContext({
      user: prospectiveUser.context.user,
      device: prospectiveUser.context.device,
      invitationSeed
    })
    peer = new Libp2pService(prospectiveUser.context.user.userId, storage)
  }

  console.log(`Initializing new libp2p peer with ID ${await peer.getPeerId()}`)
  await peer.init()
  
  return peer
}

export {
  teamInfo,
  teamAdd,
}
