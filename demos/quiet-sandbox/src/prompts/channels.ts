import inquirer from 'inquirer';
import { input } from '@inquirer/prompts';

import chalk from 'chalk';

import { LocalUserContext } from '@localfirst/auth';

import actionSelect from '../components/actionSelect.js';
import { Networking } from '../network.js';
import { SigChain } from '../auth/chain.js';
import { Channel, RoleMemberInfo, TruncatedChannel } from '../auth/services/roles/roles.js';

type ChannelList = {
  channels: TruncatedChannel[];
  choices: { name: string; value: string }[]
}

const truncateChannel = (channel: Channel): TruncatedChannel => {
  return {
    ...channel,
    members: channel.members.map(member => ({
      id: member.userId,
      name: member.userName
    } as RoleMemberInfo))
  } as TruncatedChannel
}

const makeChannelsPrintable = (channels: (Channel | TruncatedChannel)[]) => {
  return channels.map((channel) => {
    let trunc: TruncatedChannel
    if (((channel as Channel).members[0]).userId) {
      trunc = truncateChannel(channel as Channel)
    } else {
      trunc = channel as TruncatedChannel
    }

    return {
      ...trunc,
      members: JSON.stringify(trunc.members)
    }
  })
}

const generateChannelsList = async (sigChain: SigChain, context: LocalUserContext): Promise<ChannelList> => {
  const channels = sigChain.channels.getChannels(context).map((channel) => truncateChannel(channel))
  const choices = channels.map((channel) => {
    return {
      name: `${channel.channelName} (have access? ${channel.hasRole})`,
      // description: channel.description,
      value: channel.channelName,
    };
  });

  return {
    channels,
    choices
  }
}

const addUser = async (channelName: string, sigChain: SigChain, context: LocalUserContext) => {
  const username = await input({
    message: "What is the name of the user you want to add to this channel?",
    default: undefined,
    validate: (username: string) => username != null ? true : "Must enter a valid username!"
  });

  const member = sigChain.users.getMemberByName(username)
  if (member == null) {
    console.warn(`No member with name ${username} found!`)
    return
  }

  if (sigChain.channels.memberInChannel(member.userId, channelName)) {
    console.warn(`User ${username} with ID ${member.userId} is already in ${channelName}`)
    return
  }

  sigChain.channels.addMemberToPrivateChannel(member.userId, channelName)
}

const removeUser = async (channelName: string, sigChain: SigChain, context: LocalUserContext) => {
  const username = await input({
    message: "What is the name of the user you want to remove from this channel?",
    default: undefined,
    validate: (username: string) => username != null ? true : "Must enter a valid username!"
  });

  const member = sigChain.users.getMemberByName(username)
  if (member == null) {
    console.warn(`No member with name ${username} found!`)
    return
  }

  if (!sigChain.channels.memberInChannel(member.userId, channelName)) {
    console.warn(`User ${username} with ID ${member.userId} is not in ${channelName}`)
    return
  }

  sigChain.channels.addMemberToPrivateChannel(member.userId, channelName)
}

const sendMessage = async (
  channelName: string, 
  networking: Networking, 
  sigChain: SigChain, 
  context: LocalUserContext
) => {


}

const readMessages = async (
  channelName: string, 
  networking: Networking, 
  sigChain: SigChain, 
  context: LocalUserContext
) => {


}

const mainLoop = async (networking: Networking) => {
  const sigChain = networking.libp2p.storage.getSigChain()!
  const context = networking.libp2p.storage.getContext()!

  let exit = false;
  while (exit === false) {
    const generatedChannelsList = await generateChannelsList(sigChain, context)
    const {
      choices,
      channels
    } = generatedChannelsList

    const answer = await actionSelect({
      message: "Select a channel",
      choices,
      actions: [
        { name: "Select", value: "select", key: "e" },
        { name: "Delete", value: "delete", key: "d" },
        { name: "Leave", value: "leave", key: "l" },
        { name: "Add User", value: "addUser", key: "a" },
        { name: "Remove User", value: "removeUser", key: "r" },
        { name: "Send Message", value: "sendMessage", key: "s" },
        { name: "Read Messages", value: "readMessages", key: "m" },
        { name: "Back", value: "back", key: "q" },
      ],
    });

    const channel = channels.find(channel => channel.channelName === answer.answer)!
    switch (answer.action) {
      case "select":
      case undefined: // catches enter/return key
        console.table(makeChannelsPrintable([channel]))
        break;
      case "delete":
        if (!channel.hasRole) {
          console.warn(`Not a member of ${channel.channelName}!`);
          break;
        }

        console.log(chalk.bold(`Deleting ${channel.channelName}`));
        sigChain.channels.deletePrivateChannel(channel.channelName)
        break;
      case "leave":
        if (!channel.hasRole) {
          console.warn(`Not a member of ${channel.channelName}!`);
          break;
        }

        sigChain.channels.leaveChannel(channel.channelName, context)
        console.log(chalk.bold(`You have left ${channel.channelName}`));
        break;
      case "addUser":
        if (!channel.hasRole) {
          console.warn(`Not a member of ${channel.channelName}!`);
          break;
        }

        await addUser(channel.channelName, sigChain, context)
        break;
      case "removeUser":
        if (!channel.hasRole) {
          console.warn(`Not a member of ${channel.channelName}!`);
          break;
        }

        await removeUser(channel.channelName, sigChain, context)
        break;
      case "sendMessage":
        if (!channel.hasRole) {
          console.warn(`Not a member of ${channel.channelName}!`);
          break;
        }

        await sendMessage(channel.channelName, networking, sigChain, context)
        break;
      case "readMessages":
        if (!channel.hasRole) {
          console.warn(`Not a member of ${channel.channelName}!`);
          break;
        }

        await readMessages(channel.channelName, networking, sigChain, context)
        break;
      case "back":
        exit = true;
        break;
    };
  }
}

const channelCreate = async (networking: Networking | undefined) => {
  if (networking == null || networking.libp2p == null || networking.libp2p.libp2p == null) {
    console.log("Must initialize the Networking wrapper")
    return
  }

  if (networking.libp2p.storage.getSigChain() == null) {
    console.warn("Must have a valid sig chain to view/edit channels")
    return
  }

  const sigChain = networking.libp2p.storage.getSigChain()!
  const context = networking.libp2p.storage.getContext()!

  const channelMetadata = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "Enter the name of the channel",
      validate: (name) => name != null && name.length != 0 ? true : "Must enter a valid channel name!"
    },
  ]);

  const confirmation = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Create channel ${channelMetadata.name}?`,
    },
  ]);
  if (confirmation.confirm) {
    sigChain.channels.createPrivateChannel(channelMetadata.name, context)
    console.log(chalk.bold(`You have created ${channelMetadata.name}`));
  } else {
    return
  }

  await mainLoop(networking)
}

const channelsList = async (networking: Networking | undefined) => {
  if (networking == null || networking.libp2p == null || networking.libp2p.libp2p == null) {
    console.log("Must initialize the Networking wrapper")
    return
  }

  if (networking.libp2p.storage.getSigChain() == null) {
    console.warn("Must have a valid sig chain to view/edit channels")
    return
  }

  const sigChain = networking.libp2p.storage.getSigChain()!
  const context = networking.libp2p.storage.getContext()!

  let exit = false;
  while (exit === false) {
    const generatedChannelsList = await generateChannelsList(sigChain, context)
    const {
      channels
    } = generatedChannelsList

    if (channels.length === 0) {
      console.log(chalk.bold("You are not in any channels"));
      const answer = await inquirer.prompt([
        {
          type: "select",
          name: "action",
          message: "What would you like to do?",
          choices: [
            { name: "Create a channel", value: "create" },
            { name: "Back", value: "back" },
          ],
        }]);
      switch (answer.action) {
        case "create":
          await channelCreate(networking)
          break;
        case "back":
          exit = true;
          break;
      };
      break;
    } else {
      exit = true;
    }
  };

  await mainLoop(networking);
};

export {
  channelsList,
  channelCreate,
  makeChannelsPrintable
}