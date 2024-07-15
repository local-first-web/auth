#! /usr/bin/env node

import { SigChain } from "./auth/chain.js";

import figlet from 'figlet'

console.log(figlet.textSync('Quiet Sandbox'));

const { initialUser, sigChain } = SigChain.create('foobar', 'isla')
sigChain.createRoleWithMembers('some-role', [initialUser.userId])

console.log('\n---- USER ----\n')
console.log(`ID: ${initialUser.userId}`)
console.log(`Name: ${initialUser.userName}`)
console.log(`Keys: ${JSON.stringify(initialUser.keys, null, 2)}`)

console.log('\n---- Team ----\n')
console.log(`Members: ${JSON.stringify(sigChain.getMembers(), null, 2)}`)
console.log(`Role keys: ${JSON.stringify(sigChain.getTeam().roleKeys('some-role'), null, 2)}`)
// console.log(`Graph: ${JSON.stringify(sigChain.getTeamGraph())}`)
