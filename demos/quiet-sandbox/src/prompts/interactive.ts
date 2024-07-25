#! /usr/bin/env ts-node

import inquirer from 'inquirer';
import chalk from 'chalk';

import actionSelect from '../components/actionSelect.js';
import { teamAdd, teamInfo } from './team.js';
import { channelCreate, channelsList } from './channels.js';
import usersList from './users.js';
import rolesList from './rolesList.js';
import { invitesList, inviteAdd } from './invites.js';
import { Libp2pService, Storage } from '../network.js';
import { peerConnect, peerInfo } from './peers.js';
import { me } from './me.js';

const mainLoop = async (storage: Storage, peer?: Libp2pService) => {
  let exit = false;
  while (exit === false) {
    const defaultChoices = [
      { name: "Team", value: "team", description: "Explore team information"},
      { name: "Me", value: "me", description: "Explore my information" }
    ]
    const otherChoices = storage.getSigChain() == null ? [] : [
      { name: "Peers", value: "peers", description: "Explore peers" },
      { name: "Channels", value: "channels", description: "Explore channels" },
      { name: "Users", value: "users", description: "Explore users" },
      { name: "Roles", value: "roles", description: "Explore roles" },
      { name: "Invites", value: "invites", description: "Explore invites" },
    ]
    const answer = await actionSelect(
        {
          message: chalk.bold("Main Menu"),
          choices: [...defaultChoices, ...otherChoices],
          actions: [
            { name: "Select", value: "select", key: "e" },
            { name: 'Add', value: "add", key: "a" },
            { name: "Exit Program", value: "exit", key: "escape" },
          ]
        },
      )
    switch (answer.action) {
      case "select":
      case undefined: // catches enter/return key
        switch (answer.answer) {
          case "team":
            await teamInfo(peer);
            break;
          case "me":
            await me(peer)
            break;
          case "channels":
            await channelsList(peer);
            break;
          case "users":
            await usersList();
            break;
          case "roles":
            await rolesList();
            break;
          case "invites":
            await invitesList(storage);
            break;
          case "peers":
            await peerInfo(peer);
            break;
        }
        break;
      case "add":
        switch (answer.answer) {
          case "invites":
            await inviteAdd(storage)
            break;
          case "peers":
            await peerConnect(peer)
            break;
          case "channels":
            await channelCreate(peer)
            break;
          case undefined:
            break
        }
        break;
      case "exit":
        exit = true;
        break;
    }
  };
  return exit
};

const interactive = async () => {
  const storage = new Storage()
  let peer: Libp2pService | undefined

  console.log(chalk.magentaBright.bold.underline("Quiet Sandbox"));
  console.log("Navigate options with arrow keys, use E to select, and Q to go back.");
  let exit = false;
  while (exit === false) {
    peer = await teamAdd(storage, peer)
    if (peer != null) {
      exit = true
    }
  };

  await mainLoop(storage, peer)
  console.log(chalk.magentaBright.bold("Goodbye!"));
};

export default interactive;
