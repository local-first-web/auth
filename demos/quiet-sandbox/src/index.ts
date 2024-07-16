#! /usr/bin/env node

import { SigChainManager } from "auth/chain_manager.js";
import { SigChain } from "./auth/chain.js";

import figlet from 'figlet'
import { RoleService } from "auth/services/roles/role_service.js";
import { UserService } from "auth/services/members/user_service.js";
import { DMService } from "auth/services/dm/dm_service.js";

console.log(figlet.textSync('Quiet Sandbox'));

const manager = SigChainManager.init()

const teamName = 'test-team'
const username = 'isla'
const { context, sigChain } = SigChain.create(teamName, username)
const isActive = manager.addChain(teamName, sigChain, true)
console.log(`Is new chain active?: ${isActive}`)

RoleService.getInstance().createWithMembers('some-role', [context.user.userId])

console.log('\n---- USER ----\n')
console.log(`ID: ${context.user.userId}`)
console.log(`Name: ${context.user.userName}`)
console.log(`Keys: ${JSON.stringify(context.user.keys, null, 2)}`)

console.log('\n---- Team ----\n')
console.log(`Members: ${JSON.stringify(UserService.getInstance().getAllMembers(), null, 2)}`)
console.log(`Role keys: ${JSON.stringify(sigChain.getTeam().roleKeys('some-role'), null, 2)}`)

const dmId = DMService.getInstance().create([context.user.userId])
const keys = DMService.getInstance().getDmKeysById(dmId)

console.log('\n---- DM ----\n')
console.log(`DM ID: ${dmId}`)
console.log(`DM Keys: ${JSON.stringify(keys, null, 2)}`)
