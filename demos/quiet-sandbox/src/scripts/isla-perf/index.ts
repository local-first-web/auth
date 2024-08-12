#! /usr/bin/env ts-node

import { DEFAULT_INVITATION_VALID_FOR_MS, DEFAULT_MAX_USES } from "../../auth/services/invites/inviteService.js";
import { Networking } from "../../network.js";
import { sleep } from "../../utils/utils.js";
import { createTeam, joinTeam } from "./team.js";

async function main() {
  const teamName = 'perf-test-team';
  const foundingUsername = 'founding-perf-user';
  const founder = await createTeam(teamName, foundingUsername);
  const founderPeerAddress = founder.libp2p.libp2p!.getMultiaddrs()[0].toString();

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
  const iterations = 2;
  const users: Networking[] = []
  let inviteIndex = 0;

  console.log(`Generating ${iterations} users`);
  for (let i = 0; i < iterations; i++) {
    const inviteSeed = inviteSeeds[inviteIndex];
    const username = `${baseUsername}${i}`;
    const user = await joinTeam(teamName, username, inviteSeed, founderPeerAddress);
    users.push(user);
    if (inviteIndex === inviteSeeds.length - 1) {
      inviteIndex = 0;
    } else {
      inviteIndex++;
    }
  }

  await sleep(30000)
}

main().then(() => process.exit());