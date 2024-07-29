#! /usr/bin/env ts-node

import chalk from 'chalk';

import actionSelect from '../components/actionSelect.js';
import { teamAdd, teamInfo } from './team.js';
import { channelCreate, channelsList } from './channels.js';
import { invitesList, inviteAdd } from './invites.js';
import { LocalStorage, Networking } from '../network.js';
import { peerConnect, peerInfo } from './peers.js';
import { me } from './me.js';
import { roleCreate, rolesList } from './roles.js';

const mainLoop = async (storage: LocalStorage, networking?: Networking) => {
  let exit = false;
  while (exit === false) {
    const defaultChoices = [
      { name: "Team", value: "team", description: "Explore team information"},
      { name: "Me", value: "me", description: "Explore my information" }
    ]
    const otherChoices = storage.getSigChain() == null ? [] : [
      { name: "Peers", value: "peers", description: "Explore peers" },
      { name: "Channels", value: "channels", description: "Explore channels" },
      // { name: "Users", value: "users", description: "Explore users" },
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
            await teamInfo(networking);
            break;
          case "me":
            await me(networking)
            break;
          case "channels":
            await channelsList(networking);
            break;
          // case "users":
          //   await userListt();
          //   break;
          case "roles":
            await rolesList(networking);
            break;
          case "invites":
            await invitesList(storage);
            break;
          case "peers":
            await peerInfo(networking);
            break;
        }
        break;
      case "add":
        switch (answer.answer) {
          case "invites":
            await inviteAdd(storage)
            break;
          case "peers":
            await peerConnect(networking)
            break;
          case "channels":
            await channelCreate(networking)
            break;
          case "roles":
            await roleCreate(networking)
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
  const storage = new LocalStorage()
  let networking: Networking | undefined

  console.log(chalk.magentaBright.bold.underline("Quiet Sandbox"));
  console.log("Navigate options with arrow keys, use E to select, and Q to go back.");
  let exit = false;
  while (exit === false) {
    networking = await teamAdd(storage, networking)
    if (networking != null) {
      exit = true
    }
  };

  await mainLoop(storage, networking)
  console.log(chalk.magentaBright.bold("Goodbye!"));
};

export default interactive;
