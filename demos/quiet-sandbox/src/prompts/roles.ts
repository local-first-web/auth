import inquirer from 'inquirer';
import { input, select, checkbox, confirm } from '@inquirer/prompts';

import chalk from 'chalk';

import { LocalUserContext, Member } from '@localfirst/auth';

import actionSelect from '../components/actionSelect.js';
import { Networking } from '../network/network.js';
import { SigChain } from '../auth/chain.js';
import { QuietRole, RoleMemberInfo, TruncatedQuietRole } from '../auth/services/roles/roles.js';

type RolesList = {
  roles: (QuietRole | TruncatedQuietRole)[];
  choices: { name: string; value: string }[]
}

const truncateRole = (role: QuietRole): TruncatedQuietRole => {
  return {
    ...role,
    members: role.members.map(member => ({
      id: member.userId,
      name: member.userName
    } as RoleMemberInfo))
  } as TruncatedQuietRole
}

const makeRolesPrintable = (roles: (QuietRole | TruncatedQuietRole)[], networking: Networking) => {
  return roles.map((role) => {
    let trunc: TruncatedQuietRole
    if ((role as QuietRole).members.length > 0 && ((role as QuietRole).members[0]).userId) {
      trunc = truncateRole(role as QuietRole)
    } else {
      trunc = role as TruncatedQuietRole
    }

    let keyString: string
    try {
      const keys = networking.libp2p.storage.getSigChain()!.crypto.getKeysForRole(role.roleName);
      keyString = JSON.stringify({
        public: keys.encryption.publicKey,
        generation: keys.generation
      }) 
    } catch (e) {
      if ((e as Error).message.includes("Couldn't find keys")) {
        console.warn(`Can't display key information for role ${role.roleName} because this user doesn't have the role!`);
        keyString = "Not a member of role"
      } else {
        console.error(`Error occurred while fetching keys for role ${role.roleName}`, e);
        keyString = "Couldn't fetch keys due to error"
      }
    }

    return {
      ...trunc,
      members: JSON.stringify(trunc.members),
      key: keyString
    }
  })
}

const generateRolesList = async (sigChain: SigChain, context: LocalUserContext): Promise<RolesList> => {
  const roles = sigChain.roles.getAllRoles(context).filter(
    role => !sigChain.channels.isRoleChannel(context, role.roleName)
  ).map((role) => truncateRole(role));

  const choices = roles.map((role) => {
    return {
      name: `${role.roleName} (have access? ${role.hasRole})`,
      value: role.roleName,
    };
  });

  return {
    roles,
    choices
  }
}

const addUser = async (roleName: string, sigChain: SigChain, context: LocalUserContext) => {
  const roleMembers: Member[] = sigChain.roles.getRole(roleName, context).members
  const nonMembers = sigChain.users.getAllMembers().filter(member => !roleMembers.includes(member))
  if (nonMembers.length === 0) {
    console.warn(`No users to add to ${roleName}`)
    return
  }

  const addingMember = await select({
      message: `Choose a member to add to ${roleName}`,
      choices: nonMembers.map(member => ({
        name: member.userName,
        value: member
      })),
  });

  if (sigChain.roles.memberHasRole(addingMember.userId, roleName)) {
    console.warn(`User ${addingMember.userName} with ID ${addingMember.userId} already has role ${roleName}`)
    return
  }

  sigChain.roles.addMember(addingMember.userId, roleName)
}

const removeUser = async (roleName: string, sigChain: SigChain, context: LocalUserContext) => {
  const roleMembers: Member[] = sigChain.roles.getRole(roleName, context).members
  if (roleMembers.length === 1) {
    console.warn(`You are the only member of ${roleName}!  If you wish to leave the role use the 'Leave' function.`)
    return
  }

  const removingMember = await select({
    message: `Choose a member to remove from ${roleName}`,
    choices: roleMembers.filter(member => member.userName != context.user.userName).map(member => ({
      name: member.userName,
      value: member
    })),
  });

  if (!sigChain.roles.memberHasRole(removingMember.userId, roleName)) {
    console.warn(`User ${removingMember.userName} with ID ${removingMember.userId} does not have role ${roleName}`)
    return
  }

  sigChain.roles.revokeMembership(removingMember.userId, roleName)
}

const mainLoop = async (networking: Networking) => {
  const sigChain = networking.libp2p.storage.getSigChain()!
  const context = networking.libp2p.storage.getContext()!

  let exit = false;
  while (exit === false) {
    const generatedRolesList = await generateRolesList(sigChain, context)
    const {
      choices,
      roles
    } = generatedRolesList

    const answer = await actionSelect({
      message: "Select a role",
      choices,
      actions: [
        { name: "Select", value: "select", key: "e" },
        { name: "Delete", value: "delete", key: "d" },
        { name: "Leave", value: "leave", key: "l" },
        { name: "Add User", value: "addUser", key: "a" },
        { name: "Remove User", value: "removeUser", key: "r" },
        { name: "Back", value: "back", key: "q" },
      ],
    });

    const role = roles.find(role => role.roleName === answer.answer)!
    switch (answer.action) {
      case "select":
      case undefined: // catches enter/return key
        console.table(makeRolesPrintable([role], networking))
        break;
      case "delete":
        try {
          console.log(chalk.bold(`Deleting ${role.roleName}`));
          sigChain.roles.delete(role.roleName)
        } catch (e: any) {
          if ((e as Error).message.includes("Couldn't find keys")) {
            console.warn(`You are not a member of role ${role.roleName}`, (e as Error).message);
          } else {
            console.error(`An error occurred while deleting role ${role.roleName}`, e);
          }
        }
        break;
      case "leave":
        try {
          sigChain.roles.revokeMembership(context.user.userId, role.roleName);
          console.log(chalk.bold(`You have left ${role.roleName}`));
        } catch (e: any) {
          if ((e as Error).message.includes("Couldn't find keys")) {
            console.warn(`You are not a member of role ${role.roleName}`, (e as Error).message);
          } else {
            console.error(`An error occurred while leaving role ${role.roleName}`, e);
          }
        }
        break;
      case "addUser":
        try {
          await addUser(role.roleName, sigChain, context);
        } catch (e: any) {
          if ((e as Error).message.includes("Couldn't find keys")) {
            console.warn(`You are not a member of role ${role.roleName}`, (e as Error).message);
          } else {
            console.error(`An error occurred while adding user to role ${role.roleName}`, e);
          }
        }
        break;
      case "removeUser":
        try {
          await removeUser(role.roleName, sigChain, context);
        } catch (e: any) {
          if ((e as Error).message.includes("Couldn't find keys")) {
            console.warn(`You are not a member of role ${role.roleName}`, (e as Error).message);
          } else {
            console.error(`An error occurred while removing user from role ${role.roleName}`, e);
          }
        }
        break;
      case "back":
        exit = true;
        break;
    };
  }
}

const roleCreate = async (networking: Networking | undefined) => {
  if (networking == null || networking.libp2p == null || networking.libp2p.libp2p == null) {
    console.log("Must initialize the Networking wrapper")
    return
  }

  if (networking.libp2p.storage.getSigChain() == null) {
    console.warn("Must have a valid sig chain to view/edit roles")
    return
  }

  const sigChain = networking.libp2p.storage.getSigChain()!
  const context = networking.libp2p.storage.getContext()!

  const roleName = await input(
    {
      message: "Enter the name of the role",
      validate: (name) => name != null && name.length != 0 ? true : "Must enter a valid role name!"
    },
  );

  const addSelf = await confirm({
    message: "Would you like to add yourself to this role now?",
    default: true
  })

  const addOtherMembers = await confirm({
    message: "Would you like to add other members to this role now?",
    default: true
  })

  let addedMembers: string[] = addSelf ? [context.user.userId] : []
  if (addOtherMembers) {
    const otherMembers = sigChain.users.getAllMembers();
    if (otherMembers.length === 1) {
      console.warn(`No users to add to ${roleName}`)
    } else {
      addedMembers.push(...(await checkbox({
        message: "Would you like to add any members to this role on creation?",
        choices: otherMembers.map(member => ({
          name: member.userName,
          value: member.userId
        }))
      })))
    }
  }

  const confirmation = await confirm(
    {
      message: `Create role ${roleName} with ${addedMembers.length} members?`,
      default: true
    },
  );
  if (confirmation) {
    try {
      if (addedMembers.length === 0) {
        sigChain.roles.create(roleName)
      } else {
        sigChain.roles.createWithMembers(roleName, addedMembers)
      }
      console.log(chalk.bold(`You have created ${roleName}`));
    } catch (e) {
      if ((e as Error).message.includes("Couldn't find keys")) {
        console.warn(`You are missing a role required to create new roles/channels`, (e as Error).message);
      } else {
        console.error(`An error occurred while creating role ${roleName}`, e);
      }
    }
  } else {
    return
  }

  await mainLoop(networking)
}

const rolesList = async (networking: Networking | undefined) => {
  if (networking == null || networking.libp2p == null || networking.libp2p.libp2p == null) {
    console.log("Must initialize the Networking wrapper")
    return
  }

  if (networking.libp2p.storage.getSigChain() == null) {
    console.warn("Must have a valid sig chain to view/edit roles")
    return
  }

  const sigChain = networking.libp2p.storage.getSigChain()!
  const context = networking.libp2p.storage.getContext()!

  let exit = false;
  while (exit === false) {
    const generatedRolesList = await generateRolesList(sigChain, context)
    const {
      roles
    } = generatedRolesList

    if (roles.length === 0) {
      console.log(chalk.bold("You are not in any roles"));
      const answer = await inquirer.prompt([
        {
          type: "select",
          name: "action",
          message: "What would you like to do?",
          choices: [
            { name: "Create a role", value: "create" },
            { name: "Back", value: "back" },
          ],
        }]);
      switch (answer.action) {
        case "create":
          await roleCreate(networking)
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
  rolesList,
  roleCreate,
  makeRolesPrintable
}