import { RunData, storeRunData } from "./runData.js";
import { generateSnapshot } from "./snapshots.js";
import { createInvites } from "./team.js";
import { createFounderAndChain, createUserAndDial } from "./users.js";

export async function mainLoop(runData: RunData): Promise<RunData> {
  let usersToGenerate: number = runData.appSettings.userCount
  let startingIndex = 0
  if (runData.remoteUserNames == null) {
    const founder = await createFounderAndChain(runData)
    runData.inviteSeeds = await createInvites(founder)
    runData.users.push(founder)
    usersToGenerate -= 1
  } else {
    startingIndex = runData.remoteUserNames.length - 1
  }

  let inviteIndex = 0
  console.log(`Generating ${usersToGenerate} users`);
  for (let i = startingIndex; i < usersToGenerate+startingIndex; i++) {
    try {
      const user = await createUserAndDial(i, runData.inviteSeeds[inviteIndex], runData)
      runData.users.push(user);
      runData.peerAddresses.add(user.libp2p.libp2p!.getMultiaddrs()[0].toString())
    } catch (e) {
      console.warn(`Nothing to do, this user failed!`)
    }

    if (inviteIndex === runData.inviteSeeds.length - 1) {
      inviteIndex = 0;
    } else {
      inviteIndex++;
    }

    if (runData.users.length % runData.appSettings.snapshotInterval === 0) {
      const snapshot = await generateSnapshot(runData)
      runData.snapshots.push(snapshot)
    }
  }

  storeRunData(runData)

  return runData
}