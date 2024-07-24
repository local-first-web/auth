#! /usr/bin/env ts-node

import { SigChain } from "../auth/chain.js";

import figlet from 'figlet'
import { RoleName } from "../auth/services/roles/roles.js";
import { EncryptionScopeType } from "../auth/services/crypto/types.js";
import { UserService } from "../auth/services/members/userService.js";

console.log(figlet.textSync('Quiet Sandbox'));

const teamName = 'test-team'
const username = 'isla'
const { context, sigChain } = SigChain.create(teamName, username)

console.log('\n---- USER ----\n')
console.log(`ID: ${context.user.userId}`)
console.log(`Name: ${context.user.userName}`)
console.log(`Keys: ${JSON.stringify(context.user.keys, null, 2)}`)

console.log('\n---- Team ----\n')
console.log(`Members: ${JSON.stringify(sigChain.users.getAllMembers(), null, 2)}`)
console.log(`Role keys: ${JSON.stringify(sigChain.team.roleKeys(RoleName.MEMBER), null, 2)}`)

const dmId = sigChain.dms.create([context.user.userId])
const keys = sigChain.dms.getDmKeysById(dmId)

console.log('\n---- DM ----\n')
console.log(`DM ID: ${dmId}`)
console.log(`DM Keys: ${JSON.stringify(keys, null, 2)}`)

const channelName = 'some-channel'
sigChain.channels.createPrivateChannel(channelName)
const encryptedAndSignedChannel = sigChain.crypto.encryptAndSign('foobar', { type: EncryptionScopeType.CHANNEL, name: channelName }, context)

console.log('\n---- Channels ----\n')
console.log(`Channel Keys: ${JSON.stringify(sigChain.crypto.getKeysForChannel(channelName), null, 2)}`)
console.log(`Encrypted and signed: ${JSON.stringify(encryptedAndSignedChannel, null, 2)}`)
console.log(`Decrypted: ${sigChain.crypto.decryptAndVerify(encryptedAndSignedChannel.encrypted, encryptedAndSignedChannel.signature, context)}`)

const invitation = sigChain.invites.create()

console.log('\n---- Invite ----\n')
console.log(`Invite Result: ${JSON.stringify(invitation, null, 2)}`)

let invitationState = sigChain.invites.getById(invitation.id)

console.log(`Invite State (Active): ${JSON.stringify(invitationState, null, 2)}`)

sigChain.invites.revoke(invitation.id)
invitationState = sigChain.invites.getById(invitation.id)

console.log(`Invite State (Revoked): ${JSON.stringify(invitationState, null, 2)}`)

const newInvitation = sigChain.invites.create()

console.log('\n---- Invite With Proof ----\n')
console.log(`Invite Result: ${JSON.stringify(newInvitation, null, 2)}`)

const newUsername = 'isntla'
const prospectiveMember = UserService.createFromInviteSeed(newUsername, newInvitation.seed)

console.log(`Prospective Member: ${JSON.stringify(prospectiveMember, null, 2)}`)

sigChain.invites.admitMemberFromInvite(
  prospectiveMember.inviteProof, 
  prospectiveMember.context.user.userName, 
  prospectiveMember.context.user.userId,
  prospectiveMember.publicKeys
)

const {
  context: newUsersContext,
  sigChain: newUsersChain
} = SigChain.join(
  prospectiveMember.context, 
  sigChain.persist(), 
  sigChain.team.teamKeyring()
)

console.log(`All keys for new user: ${JSON.stringify(newUsersChain.users.getKeys(), null, 2)}`)

console.log(`Members: ${JSON.stringify(newUsersChain.users.getAllMembers(), null, 2)}`)

const encryptedAndSigned = newUsersChain.crypto.encryptAndSign('foobar', { type: EncryptionScopeType.ROLE, name: RoleName.MEMBER }, newUsersContext)
console.log(`Encrypted and signed: ${JSON.stringify(encryptedAndSigned, null, 2)}`)
console.log(`Decrypted: ${newUsersChain.crypto.decryptAndVerify(encryptedAndSigned.encrypted, encryptedAndSigned.signature, newUsersContext)}`)