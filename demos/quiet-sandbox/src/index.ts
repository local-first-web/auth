#! /usr/bin/env ts-node

import { program } from '@commander-js/extra-typings';

import interactive from './prompts/interactive.js';

// Helper function for logging
const logOptions = (globalOptions: object, commandOptions: object) => {
  console.log('Global Options:', globalOptions);
  console.log('Command Options:', commandOptions);
};

program
  .name('qsb')
  .description('Quiet Sandbox CLI')
  .version('0.0.1');

// Global Flags
program
  .option('-p, --peer <peer>', 'Directs the specified peer instead of the default user to perform the command')
  .option('-v, --verbose', 'Verbose mode')
  .option('-d, --dry', 'Dry run')

// Interactive mode
program
  .command('interactive')
  .description('Interactive mode')
  .action(() => {
    interactive();
  });

  const team = program.command('team').description('Team management commands');

  team
    .command('create')
    .description('Create a new team')
    .option('-n, --name <team name>', 'Specifies the name of the team to be created', undefined)
    .option('-u, --username <user name>', 'Specifies the name of the founding user', undefined)
    .action((options) => {
      const globalOptions = program.opts();
      logOptions(globalOptions, options)
      console.log(`Creating team: \n\n    Team Name: ${options.name}\n    Username: ${options.username}`)
    })

// User Management
const user = program.command('user').description('User management commands');

user
  .command('add')
  .description('Add a user')
  .option('-s, --seed <seed...>', 'Specifies the seed to use in generating the user keys')
  .option('-u, --uuid <user_id...>', 'Specifies the user ID to assign to the user')
  .argument('<user_name...>', 'Username')
  .action((userName, options) => {
    const globalOptions = program.opts();
    logOptions(globalOptions, options);
    console.log(`Adding user: ${userName}`);
  });

user
  .command('remove')
  .description('Remove users')
  .option('-u, --uuid', 'Interpret the argument as a UUID')
  .option('-a, --all', 'Remove all users but yourself')
  .option('-b, --but', 'Remove all users except for the specified')
  .argument('[user_name...]', 'Usernames')
  .action((userNames, options) => {
    const globalOptions = program.opts();
    logOptions(globalOptions, options);
    console.log(`Removing users: ${userNames.join(', ')}`);
  });

user
  .command('create')
  .description('Create a virtual user')
  .option('-s, --seed <seed...>', 'Specifies the seed to use in generating the user keys')
  .option('-u, --uuid <user_id...>', 'Specifies the user ID to assign to the user')
  .argument('<user_name...>', 'Username')
  .action((userName, options) => {
    const globalOptions = program.opts();
    logOptions(globalOptions, options);
    console.log(`Creating virtual user: ${userName}`);
  });

// Invitations
const invite = program.command('invite').description('Invitation management commands');

invite
  .command('add')
  .description('Create a new invite')
  .option('-t, --ttl <time_to_live>', 'Time to live')
  .option('-u, --uses <int>', 'Number of uses')
  .action((options) => {
    const globalOptions = program.opts();
    logOptions(globalOptions, options);
    console.log('Creating invite');
  });

invite
  .command('remove')
  .description('Revoke an invite')
  .argument('<invite_id>', 'Invite ID')
  .action((inviteId) => {
    const globalOptions = program.opts();
    logOptions(globalOptions, {});
    console.log(`Revoking invite with ID: ${inviteId}`);
  });

invite
  .command('join')
  .description('Join with an invite')
  .argument('<invite-code>', 'Invite code')
  .action((inviteCode) => {
    const globalOptions = program.opts();
    logOptions(globalOptions, {});
    console.log(`Joining with invite code: ${inviteCode}`);
  });

// Role Management
const role = program.command('role').description('Role management commands');

role
  .command('create')
  .description('Create a role')
  .option('-s, --scope <permission_scope>', 'Permission scope')
  .argument('<role_name>', 'Role name')
  .action((roleName, options) => {
    const globalOptions = program.opts();
    logOptions(globalOptions, options);
    console.log(`Creating role: ${roleName}`);
  });

role
  .command('add')
  .description('Assign specified users a role')
  .argument('<role_name>', 'Role name')
  .option('-u, --uuid', 'Interpret the user operand as a UUID')
  .option('-a, --all', 'Give role to all users but yourself')
  .option('-b, --but', 'Give role to all users except for the specified')
  .argument('<user_name...>', 'Usernames')
  .action((roleName, userNames, options) => {
    const globalOptions = program.opts();
    logOptions(globalOptions, options);
    console.log(`Assigning role ${roleName} to users: ${userNames.join(', ')}`);
  });

role
  .command('remove')
  .description('Remove users from role')
  .argument('<role_name>', 'Role name')
  .option('-u, --uuid', 'Interpret the user operand as a UUID')
  .option('-a, --all', 'Remove role from all users but yourself')
  .option('-b, --but', 'Remove role from all users except for the specified')
  .argument('<user_name...>', 'Usernames')
  .action((roleName, userNames, options) => {
    const globalOptions = program.opts();
    logOptions(globalOptions, options);
    console.log(`Removing role ${roleName} from users: ${userNames.join(', ')}`);
  });

role
  .command('delete')
  .description('Delete a role')
  .argument('<role_name>', 'Role name')
  .action((roleName) => {
    const globalOptions = program.opts();
    logOptions(globalOptions, {});
    console.log(`Deleting role: ${roleName}`);
  });

// Channel Management
const channel = program.command('channel').description('Channel management commands');

channel
  .command('create')
  .description('Create a channel')
  .option('-r, --role <role_id...>', 'Roles with access to the channel')
  .argument('<channel_name>', 'Channel name')
  .action((channelName, options) => {
    const globalOptions = program.opts();
    logOptions(globalOptions, options);
    console.log(`Creating channel: ${channelName}`);
  });

channel
  .command('delete')
  .description('Delete channels')
  .option('-a, --all', 'Delete all channels')
  .option('-b, --but', 'Delete all channels except for the specified')
  .argument('<channel_name...>', 'Channel name')
  .action((channelNames, options) => {
    const globalOptions = program.opts();
    logOptions(globalOptions, options);
    console.log(`Deleting channels: ${channelNames.join(', ')}`);
  });

// Messaging and Communication
const msg = program.command('msg').description('Messaging and communication commands');

msg
  .command('send')
  .description('Send a message')
  .option('-n, --name <user_name>', 'User name')
  .option('-g, --group <group_id>', 'Group ID')
  .option('-c, --channel <channel_id>', 'Channel ID')
  .argument('<msg>', 'Message')
  .action((msg, options) => {
    const globalOptions = program.opts();
    logOptions(globalOptions, options);
    console.log(`Sending message: ${msg}`);
  });

msg
  .command('read')
  .description('Read messages in channel/group/DM')
  .option('-n, --name <user_name>', 'User name')
  .option('-g, --group <group_id>', 'Group ID')
  .option('-c, --channel <channel_id>', 'Channel ID')
  .action((options) => {
    const globalOptions = program.opts();
    logOptions(globalOptions, options);
    console.log('Reading messages');
  });

// Information and Logging
const show = program.command('show').description('Show information and logs');

show
  .command('team')
  .description('Print users/devices team state')
  .option('-u, --users', 'Show users')
  .option('-g, --groups [group_id]', 'Show groups')
  .option('-c, --channels [channel_id]', 'Show channels')
  .option('-r, --roles [role_id]', 'Show roles')
  .option('-m, --msg [user...]', 'Show DMs')
  .option('-d, --devices [device_id]', 'Show devices')
  .option('-i, --invites [invite_id]', 'Show invites')
  .action((options) => {
    const globalOptions = program.opts();
    logOptions(globalOptions, options);
    console.log('Showing team state');
  });

show
  .command('log')
  .description('Print log of CLI actions')
  .action(() => {
    const globalOptions = program.opts();
    logOptions(globalOptions, {});
    console.log('Printing log of CLI actions');
  });

show
  .command('chain')
  .description('Print devices’ sigchain')
  .option('-p, --peer [peer_name]', 'Specify peer names')
  .action((options) => {
    const globalOptions = program.opts();
    logOptions(globalOptions, options);
    console.log('Showing chain');
  });

show
  .command('metrics')
  .description('Print metrics')
  .action(() => {
    const globalOptions = program.opts();
    logOptions(globalOptions, {});
    console.log('Printing metrics');
  });

// Virtual Peer Management
const simpeer = program.command('simpeer').description('Virtual peer management commands');

simpeer
  .command('add')
  .description('Adds virtual peer device simulations to the local environment')
  .option('-i, --uuid <device_id...>', 'Generate peers with the specified device ids')
  .option('-s, --state <state>', 'Specify state')
  .option('-n, --number <number>', 'Randomly generate the specified number of virtual peers')
  .action((options) => {
    const globalOptions = program.opts();
    logOptions(globalOptions, options);
    console.log('Adding virtual peer');
  });

simpeer
  .command('remove')
  .description('Remove a virtual peer simulation from the local environment')
  .option('-u, --uuid <device_id...>', 'Specify device id')
  .option('-p, --peer <peer_name...>', 'Remove the specified virtual peer')
  .option('-a', 'Remove all virtual peers')
  .option('-b', 'Remove all virtual peers except for the specified')
  .action((options) => {
    const globalOptions = program.opts();
    logOptions(globalOptions, options);
    console.log('Removing virtual peer');
  });

simpeer
  .command('list')
  .description('List all virtual peers in the local environment')
  .action(() => {
    const globalOptions = program.opts();
    logOptions(globalOptions, {});
    console.log('Listing all virtual peers');
  });

simpeer
  .command('set')
  .description('Set the state of a virtual peer')
  .option('-n, --name <peer_name...>', 'Specify peer name')
  .option('-s, --state <state>', 'Specify state')
  .option('-a', 'Set all virtual peers to the specified state')
  .option('-b', 'Set all virtual peers to the specified state except for the specified')
  .action((options) => {
    const globalOptions = program.opts();
    logOptions(globalOptions, options);
    console.log('Setting virtual peer state');
  });

program.parse(process.argv);
