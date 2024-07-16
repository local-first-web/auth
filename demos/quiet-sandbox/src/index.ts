#! /usr/bin/env node

import { SigChainManager } from "auth/chain_manager.js";
import { SigChain } from "./auth/chain.js";


import figlet from 'figlet'
import { RoleService } from "auth/services/roles/role_service.js";
import { UserService } from "auth/services/members/user_service.js";
import { DeviceService } from "auth/services/members/device_service.js";
import { ChannelService } from "auth/services/roles/channel_service.js";

console.log(figlet.textSync('Quiet Sandbox'));

UserService.init()
DeviceService.init()
RoleService.init()
ChannelService.init()

const teamName = 'test-team'
const { context, sigChain } = SigChain.create(teamName, 'isla')
const manager = SigChainManager.instance
manager.addChain(teamName, sigChain, true)

RoleService.getInstance().createWithMembers('some-role', [context.user.userId])

console.log('\n---- USER ----\n')
console.log(`ID: ${context.user.userId}`)
console.log(`Name: ${context.user.userName}`)
console.log(`Keys: ${JSON.stringify(context.user.keys, null, 2)}`)

console.log('\n---- Team ----\n')
console.log(`Members: ${JSON.stringify(sigChain.getMembers(), null, 2)}`)
console.log(`Role keys: ${JSON.stringify(sigChain.getTeam().roleKeys('some-role'), null, 2)}`)
// console.log(`Graph: ${JSON.stringify(sigChain.getTeamGraph())}`)
