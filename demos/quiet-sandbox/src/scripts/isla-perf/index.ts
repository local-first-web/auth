#! /usr/bin/env ts-node

import { DEFAULT_INVITATION_VALID_FOR_MS, DEFAULT_MAX_USES } from "../../auth/services/invites/inviteService.js";
import { DeviceService } from "../../auth/services/members/deviceService.js";
import { EVENTS, Networking } from "../../network.js";
import { sleep } from "../../utils/utils.js";
import { createTeam, joinTeam } from "./team.js";

async function main() {
  const peerAddresses: string[] = []
  const loadTimesMs: Map<string, number> = new Map()
  const ownerStartTimeMs = Date.now()
  const teamName = 'perf-test-team';
  const foundingUsername = 'founding-perf-user';
  const founder = await createTeam(teamName, foundingUsername);
  const ownerLoadTimeMs = Date.now() - ownerStartTimeMs
  loadTimesMs.set(foundingUsername, ownerLoadTimeMs)
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
  const iterations = 50;
  const users: Networking[] = []
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
      loadTimesMs.set(username, userLoadTimeMs)
      console.log(`User ${user.storage.getContext()?.user.userName} has initialized their chain!`)
      console.log(JSON.stringify(user.storage.getSigChain()?.users.getAllMembers().map(member => member.userName), null, 2))

      // const newDevice = DeviceService.generateDeviceForUser(user.storage.getContext()!.user.userId, `${username}-new-device`)
      // const inviteForDevice = user.storage.getSigChain()!.invites.createForDevice(inviteExpiry)
      // const deviceProof = user.storage.getSigChain()!.invites.
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
  }

  console.log(loadTimesMs)

  await sleep(30000)
  const memberCounts: Map<string, number> = new Map()
  for (const user of users) {
    const memberCount = user.storage.getSigChain()!.users.getAllMembers().length
    memberCounts.set(user.storage.getContext()!.user.userName, memberCount)
  }

  console.log(memberCounts)
}

main().then(() => process.exit());