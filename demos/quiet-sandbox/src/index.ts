#! /usr/bin/env node

import { SigChainManager } from "auth/chain_manager.js";
import { SigChain } from "./auth/chain.js";

import figlet from 'figlet'
import { RoleName } from "auth/services/roles/roles.js";
import { EncryptionScopeType } from "auth/services/crypto/types.js";

console.log(figlet.textSync('Quiet Sandbox'));

const manager = SigChainManager.init()

const teamName = 'test-team'
const username = 'isla'
const { context, sigChain } = SigChain.create(teamName, username)
const isActive = manager.addChain(teamName, sigChain, true)
console.log(`Is new chain active?: ${isActive}`)

SigChain.roles.createWithMembers(RoleName.MEMBER, [context.user.userId])

console.log('\n---- USER ----\n')
console.log(`ID: ${context.user.userId}`)
console.log(`Name: ${context.user.userName}`)
console.log(`Keys: ${JSON.stringify(context.user.keys, null, 2)}`)

console.log('\n---- Team ----\n')
console.log(`Members: ${JSON.stringify(SigChain.users.getAllMembers(), null, 2)}`)
console.log(`Role keys: ${JSON.stringify(sigChain.team.roleKeys(RoleName.MEMBER), null, 2)}`)

const dmId = SigChain.dms.create([context.user.userId])
const keys = SigChain.dms.getDmKeysById(dmId)

console.log('\n---- DM ----\n')
console.log(`DM ID: ${dmId}`)
console.log(`DM Keys: ${JSON.stringify(keys, null, 2)}`)

const invitation = SigChain.invites.create()

console.log('\n---- Invite ----\n')
console.log(`Invite Result: ${JSON.stringify(invitation, null, 2)}`)

let invitationState = SigChain.invites.getById(invitation.id)

console.log(`Invite State (Active): ${JSON.stringify(invitationState, null, 2)}`)

SigChain.invites.revoke(invitation.id)
invitationState = SigChain.invites.getById(invitation.id)

console.log(`Invite State (Revoked): ${JSON.stringify(invitationState, null, 2)}`)

const newInvitation = SigChain.invites.create()

console.log('\n---- Invite With Proof ----\n')
console.log(`Invite Result: ${JSON.stringify(newInvitation, null, 2)}`)

const newUsername = 'isntla'
const prospectiveMember = SigChain.users.createFromInviteSeed(newUsername, newInvitation.seed)

console.log(`Prospective Member: ${JSON.stringify(prospectiveMember, null, 2)}`)

SigChain.invites.admitMemberFromInvite(
  prospectiveMember.inviteProof, 
  prospectiveMember.context.user.userName, 
  prospectiveMember.context.user.userId,
  prospectiveMember.publicKeys
)

const newUsersChain = SigChain.join(
  prospectiveMember.context, 
  manager.getActiveChain().persist(), 
  manager.getActiveChain().team.teamKeyring()
)

manager.addChain(`${teamName}2`, newUsersChain.sigChain, true)
console.log(`All keys for new user: ${JSON.stringify(SigChain.users.getKeys(), null, 2)}`)

console.log(`Members: ${JSON.stringify(SigChain.users.getAllMembers(), null, 2)}`)

const encryptedAndSigned = SigChain.crypto.encryptAndSign('foobar', { type: EncryptionScopeType.ROLE, name: RoleName.MEMBER }, newUsersChain.context)
console.log(`Encrypted and signed: ${JSON.stringify(encryptedAndSigned, null, 2)}`)
console.log(`Decrypted: ${SigChain.crypto.decryptAndVerify(encryptedAndSigned.encrypted, encryptedAndSigned.signature, newUsersChain.context)}`)

