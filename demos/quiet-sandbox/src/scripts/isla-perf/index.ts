#! /usr/bin/env ts-node

import { DEFAULT_INVITATION_VALID_FOR_MS, DEFAULT_MAX_USES, InviteService } from "../../auth/services/invites/inviteService.js";
import { DeviceService } from "../../auth/services/members/deviceService.js";
import { EVENTS, Networking } from "../../network.js";
import { sleep } from "../../utils/utils.js";
import { generateDeviceName } from "./devices.js";
import { createTeam, joinTeam } from "./team.js";

import * as fs from 'fs'

type PeerRunMetadata = {
  chainLoadTimeMs: number
  memberCount: number
  memberDiff: number
  deviceCount: number
  deviceDiff: number
}

export type Diff = {
  username: string
  diff: number
}

export type DiffMeta = {
  count: number
  avg: number
}

export type Snapshot = {
  userCount: number
  avgChainLoadTimeMs: number
  memberDiffMeta: DiffMeta
  deviceDiffMeta: DiffMeta
  memberDiffs: Diff[]
  deviceDiffs: Diff[]
}

async function main() {
  const peerAddresses: string[] = []
  const runMetadata: Map<string, PeerRunMetadata> = new Map()
  const snapshots: Snapshot[] = []
  const ownerStartTimeMs = Date.now()
  const teamName = 'perf-test-team';
  const foundingUsername = 'founding-perf-user';
  const founder = await createTeam(teamName, foundingUsername);
  const ownerLoadTimeMs = Date.now() - ownerStartTimeMs
  runMetadata.set(foundingUsername, { 
    chainLoadTimeMs: ownerLoadTimeMs,
    memberCount: 0, 
    deviceCount: 0, 
    memberDiff: 0, 
    deviceDiff: 0 
  })
  console.log(`Took owner ${ownerLoadTimeMs}ms to create the chain`)

  peerAddresses.push(founder.libp2p.libp2p!.getMultiaddrs()[0].toString())

  const inviteCount = 10;
  const inviteExpiry = DEFAULT_INVITATION_VALID_FOR_MS;
  const inviteMaxUses = 50;
  const inviteSeeds: string[] = [];

  console.log(`Generating ${inviteCount} invites as founder`);
  for (let i = 0; i < inviteCount; i++) {
    const invite = founder.libp2p.storage.getSigChain()!.invites.create(inviteExpiry, inviteMaxUses);
    inviteSeeds.push(invite.seed);
  }

  const baseUsername = 'perf-user-';
  const iterations = 199;
  const snapshotInterval = 10;
  const users: Networking[] = [founder];
  let inviteIndex = 0;

  console.log(`Generating ${iterations} users`);
  for (let i = 0; i < iterations; i++) {
    const startTimeMs = Date.now()
    const inviteSeed = inviteSeeds[inviteIndex];
    const username = `${baseUsername}${i}`;
    const user = await joinTeam(teamName, username, inviteSeed, peerAddresses);
    users.push(user);
    if (inviteIndex === inviteSeeds.length - 1) {
      inviteIndex = 0;
    } else {
      inviteIndex++;
    }

    let dialFinished = false
    user.events.on(EVENTS.DIAL_FINISHED, () => {
      console.log('Dial finished!')
      dialFinished = true
    })

    let chainLoaded = user.storage.getSigChain() != null
    user.events.on(EVENTS.INITIALIZED_CHAIN, () => {
      if (chainLoaded) return

      chainLoaded = true
      const userLoadTimeMs = Date.now() - startTimeMs
      console.log(`Took user ${username} ${userLoadTimeMs}ms to load the chain`)
      runMetadata.set(username, { 
        chainLoadTimeMs: userLoadTimeMs, 
        memberCount: 0, 
        deviceCount: 0, 
        memberDiff: 0, 
        deviceDiff: 0 
      })
      console.log(`User ${user.storage.getContext()?.user.userName} has initialized their chain!`)
      // console.log(JSON.stringify(user.storage.getSigChain()?.users.getAllMembers().map(member => member.userName), null, 2))

      const deviceName = generateDeviceName(username, 2)
      const newDevice = DeviceService.generateDeviceForUser(user.storage.getContext()!.user.userId, deviceName)
      const inviteForDevice = user.storage.getSigChain()!.invites.createForDevice(inviteExpiry)
      const deviceProof = InviteService.generateProof(inviteForDevice.seed)
      user.storage.getSigChain()!.invites.admitDevice(deviceProof, newDevice)
      user.events.emit(EVENTS.INITIALIZED_CHAIN)
    })

    console.log(`Connecting to ${peerAddresses.length} peers`);
    await user.libp2p.dial(peerAddresses);

    peerAddresses.push(user.libp2p.libp2p!.getMultiaddrs()[0].toString())

    if (!dialFinished) {
      console.log(`Waiting for user to be ready!`)
      while (!dialFinished) {
        process.stdout.write('-')
        await sleep(250)
      }
      console.log('\n')
    }

    if (users.length % snapshotInterval === 0) {
      console.log(`Capturing snapshot at ${users.length} users`)
      const expectedDeviceCount = users.length * 2 - 1
      const memberDiffs: Diff[] = []
      const deviceDiffs: Diff[] = []

      let sumChainLoadTimeMs = 0
      let sumMemberDiff = 0
      let sumDeviceDiff = 0

      await sleep(5000)
      for (const user of users) {
        const members = user.storage.getSigChain()!.users.getAllMembers()
        const memberCount = members.length
        const memberDiff = users.length - memberCount
        if (memberDiff > 0) {
          memberDiffs.push({
            username: user.storage.getContext()!.user.userName,
            diff: memberDiff
          })
          sumMemberDiff += memberDiff
        }

        let deviceCount = 0
        for (const member of members) {
          deviceCount += member.devices?.length || 0
        }
        const deviceDiff = expectedDeviceCount - deviceCount
        if (deviceDiff > 0) {
          deviceDiffs.push({
            username: user.storage.getContext()!.user.userName,
            diff: deviceDiff
          })
          sumDeviceDiff += deviceDiff
        }

        const existingMetadata = runMetadata.get(user.storage.getContext()!.user.userName)!
        runMetadata.set(user.storage.getContext()!.user.userName, {
          ...existingMetadata,
          memberCount,
          memberDiff,
          deviceCount,
          deviceDiff
        })
        sumChainLoadTimeMs += existingMetadata.chainLoadTimeMs
      }
      const snapshot: Snapshot = {
        userCount: users.length,
        avgChainLoadTimeMs: sumChainLoadTimeMs / users.length,
        memberDiffs,
        deviceDiffs,
        memberDiffMeta: {
          count: memberDiffs.length,
          avg: sumMemberDiff / memberDiffs.length || 0
        },
        deviceDiffMeta: {
          count: deviceDiffs.length,
          avg: sumDeviceDiff / deviceDiffs.length || 0
        }
      }
      snapshots.push(snapshot)
    }
  }

  // console.log(runMetadata)
  const data = `const data = ${JSON.stringify(snapshots, null, 2)};`
  const filename = './src/scripts/isla-perf/data.json.js'
  fs.rmSync(filename, { force: true })
  fs.writeFileSync(filename, data, { encoding: 'utf-8' })
}

main().then(() => process.exit());