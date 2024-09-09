#! /usr/bin/env ts-node

import chalk from 'chalk';
import { confirm, input } from '@inquirer/prompts';
import clipboard from 'clipboardy';

import { SigChain } from '../auth/chain.js';
import { Networking } from '../network/network.js';
import { UserService } from '../auth/services/members/userService.js';
import { makeChannelsPrintable } from './channels.js';
import { makeRolesPrintable } from './roles.js';
import { LocalStorage } from '../network/storage.js';

const teamInfo = async (networking: Networking | undefined) => {
  if (networking == null || networking.libp2p == null || networking.libp2p.libp2p == null) {
    console.log("Must initialize the Networking wrapper and the chain to display team information")
    return
  }

  const sigChain = networking.libp2p.storage.getSigChain()!
  const context = networking.libp2p.storage.getContext()!

  console.log("--------------------");
  console.log("Team Information");
  console.log("--------------------");

  if (sigChain == null) {
    console.log("No sig chain has been setup!  Please join a team and then check back!")
    console.log("\n")
  } else {
    console.log("Name:", sigChain.team.teamName);
    console.log(chalk.bold("Channels:"));
    console.table(makeChannelsPrintable(sigChain.channels.getChannels(context), networking));
    console.log("\n");

    console.log(chalk.bold("Users"));
    console.table(sigChain.users.getAllMembers());
    console.log("\n");

    console.log(chalk.bold("Roles"));
    console.table(makeRolesPrintable(sigChain.roles.getAllRoles(context), networking));
    console.log("\n");

    console.log(chalk.bold("Invites"));
    console.table(sigChain.invites.getAllInvites());
    console.log("\n");
  }
}

const teamAdd = async (storage: LocalStorage, existingPeer?: Networking): Promise<Networking> => {
  if (storage.getContext()) {
    console.warn("Already setup team")
    if (existingPeer == null) {
      throw new Error("Already setup team context but no networking services were found!  Something very bad happened!")
    }
    return existingPeer
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
    const invitationSeed = await input({
      message: "What is your invite seed?",
      default:  await clipboard.read(),
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
  }

  console.log(`Initializing networking!`)
  const networking = await Networking.init(storage)
  
  return networking
}

export {
  teamInfo,
  teamAdd,
}
