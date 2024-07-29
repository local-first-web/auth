import inquirer from 'inquirer';
import { input, select } from '@inquirer/prompts';

import chalk from 'chalk';

import { LocalUserContext, Member } from '@localfirst/auth';

import actionSelect from '../components/actionSelect.js';
import { Networking } from '../network.js';
import { SigChain } from '../auth/chain.js';
import { Channel, RoleMemberInfo, TruncatedChannel } from '../auth/services/roles/roles.js';
import { EncryptedAndSignedPayload, EncryptionScopeType } from '../auth/services/crypto/types.js';

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

const makeChannelsPrintable = (channels: (Channel | TruncatedChannel)[], networking: Networking) => {
  return channels.map((channel) => {
    let trunc: TruncatedChannel
    if (((channel as Channel).members[0]).userId) {
      trunc = truncateChannel(channel as Channel)
    } else {
      trunc = channel as TruncatedChannel
    }

    const db = networking.messages.channelDbs[channel.channelName]
    let keyString: string
    try {
      const keys = networking.libp2p.storage.getSigChain()!.crypto.getKeysForChannel(channel.channelName);
      keyString = JSON.stringify({
        public: keys.encryption.publicKey,
        generation: keys.generation
      }) 
    } catch (e) {
      if ((e as Error).message.includes("Couldn't find keys")) {
        console.warn(`Can't display key information for channel ${channel.channelName} because this user doesn't have the role!`);
        keyString = "Not a member of role"
      } else {
        console.error(`Error occurred while fetching keys for channel ${channel.channelName}`, e);
        keyString = "Couldn't fetch keys due to error"
      }
    }

    return {
      ...trunc,
      members: JSON.stringify(trunc.members),
      dbAddr: db.address,
      key: keyString
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
  const channelMembers: Member[] = sigChain.channels.getChannel(channelName, context).members
  const nonMembers = sigChain.users.getAllMembers().filter(member => !channelMembers.includes(member))
  if (nonMembers.length === 0) {
    console.warn(`No users to add to ${channelName}`)
    return
  }

  const addingMember = await select({
      message: `Choose a member to add to ${channelName}`,
      choices: nonMembers.map(member => ({
        name: member.userName,
        value: member
      })),
  });

  if (sigChain.channels.memberInChannel(addingMember.userId, channelName)) {
    console.warn(`User ${addingMember.userName} with ID ${addingMember.userId} is already in ${channelName}`)
    return
  }

  sigChain.channels.addMemberToPrivateChannel(addingMember.userId, channelName)
}

const removeUser = async (channelName: string, sigChain: SigChain, context: LocalUserContext) => {
  const channelMembers: Member[] = sigChain.channels.getChannel(channelName, context).members
  if (channelMembers.length === 1) {
    console.warn(`You are the only member of ${channelName}!  If you wish to leave the channel use the 'Leave' function.`)
    return
  }

  const removingMember = await select({
    message: `Choose a member to remove from ${channelName}`,
    choices: channelMembers.filter(member => member.userName != context.user.userName).map(member => ({
      name: member.userName,
      value: member
    })),
  });

  if (!sigChain.channels.memberInChannel(removingMember.userId, channelName)) {
    console.warn(`User ${removingMember.userName} with ID ${removingMember.userId} is not in ${channelName}`)
    return
  }

  sigChain.channels.revokePrivateChannelMembership(removingMember.userId, channelName)
}

const sendMessage = async (
  channelName: string, 
  networking: Networking, 
  sigChain: SigChain, 
  context: LocalUserContext
) => {
  const message = await input({
    message: "What message would you like to send?",
    default: undefined,
    validate: (message: string) => message != null ? true : "Must enter a valid message!"
  });

  const encryptedMessage: EncryptedAndSignedPayload = sigChain.crypto.encryptAndSign(
    message, 
    { type: EncryptionScopeType.CHANNEL, name: channelName }, 
    context
  )

  await networking.messages.sendMessage(channelName, encryptedMessage)
}

const readMessages = async (
  channelName: string, 
  networking: Networking, 
  sigChain: SigChain, 
  context: LocalUserContext
) => {
  const encryptedMessages = await networking.messages.readMessages(channelName)
  const decryptedMessages: { userId: string; username: string; message: string; ts: number; keyGeneration: number; }[] = []
  for (const enc of encryptedMessages) {
    let message: string;
    try {
      message = sigChain.crypto.decryptAndVerify(enc.encrypted, enc.signature, context) as string
    } catch (e) {
      if (
        (e as Error).message.includes("Cannot read properties of undefined (reading 'encryption')") ||
        ((e as Error).message.includes("Couldn't find keys"))) 
      {
        message = `Decryption Error: no access to key with generation ${enc.encrypted.scope.generation}`;
      } else {
        console.error(`Unknown error occurred while decrypting message from ${enc.username} at timestamp ${enc.ts}`, e);
        message = `Decryption Error: unknown error occurred`;
      }
    }

    decryptedMessages.push({
      userId: enc.signature.author.name,
      username: enc.username,
      message,
      ts: enc.ts,
      keyGeneration: enc.encrypted.scope.generation
    })
  }
  console.table(decryptedMessages)
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
        console.table(makeChannelsPrintable([channel], networking))
        break;
      case "delete":
        try {
          console.log(chalk.bold(`Deleting ${channel.channelName}`));
          sigChain.channels.deletePrivateChannel(channel.channelName)
        } catch (e: any) {
          if ((e as Error).message.includes("Couldn't find keys")) {
            console.warn(`You are not a member of channel ${channel.channelName}`, (e as Error).message);
          } else {
            console.error(`An error occurred while deleting channel ${channel.channelName}`, e);
          }
        }
        break;
      case "leave":
        try {
          sigChain.channels.leaveChannel(channel.channelName, context);
          console.log(chalk.bold(`You have left ${channel.channelName}`));
        } catch (e: any) {
          if ((e as Error).message.includes("Couldn't find keys")) {
            console.warn(`You are not a member of channel ${channel.channelName}`, (e as Error).message);
          } else {
            console.error(`An error occurred while leaving channel ${channel.channelName}`, e);
          }
        }
        break;
      case "addUser":
        try {
          await addUser(channel.channelName, sigChain, context);
        } catch (e: any) {
          if ((e as Error).message.includes("Couldn't find keys")) {
            console.warn(`You are not a member of channel ${channel.channelName}`, (e as Error).message);
          } else {
            console.error(`An error occurred while adding user to channel ${channel.channelName}`, e);
          }
        }
        break;
      case "removeUser":
        try {
          await removeUser(channel.channelName, sigChain, context);
        } catch (e: any) {
          if ((e as Error).message.includes("Couldn't find keys")) {
            console.warn(`You are not a member of channel ${channel.channelName}`, (e as Error).message);
          } else {
            console.error(`An error occurred while removing user from channel ${channel.channelName}`, e);
          }
        }
        break;
      case "sendMessage":
        try {
          await sendMessage(channel.channelName, networking, sigChain, context)
        } catch (e: any) {
          if ((e as Error).message.includes("Couldn't find keys")) {
            console.warn(`You are not a member of channel ${channel.channelName}`, (e as Error).message);
          } else {
            console.error(`An error occurred while sending message for channel ${channel.channelName}`, e);
          }
        }
        break;
      case "readMessages":
        try {
          await readMessages(channel.channelName, networking, sigChain, context)
        } catch (e: any) {
          if ((e as Error).message.includes("Couldn't find keys")) {
            console.warn(`You are not a member of channel ${channel.channelName}`, (e as Error).message);
          } else {
            console.error(`An error occurred while reading messages for channel ${channel.channelName}`, e);
          }
        }
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
    try {
    sigChain.channels.createPrivateChannel(channelMetadata.name, context)
    await networking.messages.createChannel(channelMetadata.name)
    console.log(chalk.bold(`You have created ${channelMetadata.name}`));
    } catch (e) {
      if ((e as Error).message.includes("Couldn't find keys")) {
        console.warn(`You are missing a role required to create new roles/channels`, (e as Error).message);
      } else {
        console.error(`An error occurred while creating channel ${channelMetadata.name}`, e);
      }
    }
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