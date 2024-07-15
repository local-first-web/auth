#! /usr/bin/env node

import { SigChain } from "./auth/chain.js";

import figlet from 'figlet'

console.log(figlet.textSync('Quiet Sandbox'));

const createdChain = SigChain.create('foobar', 'isla')

console.log('\n---- USER ----\n')
console.log(`ID: ${createdChain.initialUser.userId}`)
console.log(`Name: ${createdChain.initialUser.userName}`)
console.log(`Keys: ${JSON.stringify(createdChain.initialUser.keys, null, 2)}`)

console.log('\n---- Team ----\n')
console.log(`Members: ${JSON.stringify(createdChain.sigChain.getMembers(), null, 2)}`)
console.log(`Graph: ${JSON.stringify(createdChain.sigChain.getTeamGraph())}`)
