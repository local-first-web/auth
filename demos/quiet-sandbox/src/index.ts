#! /usr/bin/env node

import { SigChainManager } from "auth/chain_manager.js";
import { SigChain } from "./auth/chain.js";

import figlet from 'figlet'
import { RoleService } from "auth/services/roles/role_service.js";
import { UserService } from "auth/services/members/user_service.js";
import { DMService } from "auth/services/dm/dm_service.js";
import { InviteService } from "auth/services/invites/invite_service.js";
import { RoleName } from "auth/services/roles/roles.js";

console.log(figlet.textSync('Quiet Sandbox'));

const manager = SigChainManager.init()

const teamName = 'test-team'
const username = 'isla'
const { context, sigChain } = SigChain.create(teamName, username)
const isActive = manager.addChain(teamName, sigChain, true)
console.log(`Is new chain active?: ${isActive}`)

RoleService.instance.createWithMembers(RoleName.MEMBER, [context.user.userId])

console.log('\n---- USER ----\n')
console.log(`ID: ${context.user.userId}`)
console.log(`Name: ${context.user.userName}`)
console.log(`Keys: ${JSON.stringify(context.user.keys, null, 2)}`)

console.log('\n---- Team ----\n')
console.log(`Members: ${JSON.stringify(UserService.instance.getAllMembers(), null, 2)}`)
console.log(`Role keys: ${JSON.stringify(sigChain.team.roleKeys(RoleName.MEMBER), null, 2)}`)

const dmId = DMService.instance.create([context.user.userId])
const keys = DMService.instance.getDmKeysById(dmId)

console.log('\n---- DM ----\n')
console.log(`DM ID: ${dmId}`)
console.log(`DM Keys: ${JSON.stringify(keys, null, 2)}`)

const invitation = InviteService.instance.create()

console.log('\n---- Invite ----\n')
console.log(`Invite Result: ${JSON.stringify(invitation, null, 2)}`)

let invitationState = InviteService.instance.getById(invitation.id)

console.log(`Invite State (Active): ${JSON.stringify(invitationState, null, 2)}`)

InviteService.instance.revoke(invitation.id)
invitationState = InviteService.instance.getById(invitation.id)

console.log(`Invite State (Revoked): ${JSON.stringify(invitationState, null, 2)}`)

const newInvitation = InviteService.instance.create()

console.log('\n---- Invite With Proof ----\n')
console.log(`Invite Result: ${JSON.stringify(newInvitation, null, 2)}`)

const newUsername = 'isntla'
const prospectiveMember = UserService.instance.createFromInviteSeed(newUsername, newInvitation.seed)

console.log(`Prospective Member: ${JSON.stringify(prospectiveMember, null, 2)}`)

UserService.instance.admitMemberFromInvite(
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

console.log(`Members: ${JSON.stringify(UserService.instance.getAllMembers(), null, 2)}`)

