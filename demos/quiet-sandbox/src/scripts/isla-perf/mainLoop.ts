import { sleep } from "../../utils/utils.js";
import { createLogger } from "./logger.js";
import { RunData, storeRunData } from "./runData.js";
import { generateSnapshot } from "./snapshots.js";
import { createInvites } from "./team.js";
import { createFounderAndChain, createUserAndDial } from "./users.js";

const LOGGER = createLogger("main")

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
  LOGGER.info(`Generating ${usersToGenerate} users`);
  for (let i = startingIndex; i < usersToGenerate+startingIndex; i++) {
    try {
      const user = await createUserAndDial(i, runData.inviteSeeds[inviteIndex], runData)
      runData.users.push(user);
      runData.peerAddresses.add(user.libp2p.libp2p!.getMultiaddrs()[0].toString())
    } catch (e) {
      LOGGER.error(`Nothing to do, this user failed!`, e)
    }

    if (inviteIndex === runData.inviteSeeds.length - 1) {
      inviteIndex = 0;
    } else {
      inviteIndex++;
    }

    if (runData.users.length % runData.appSettings.snapshotInterval === 0) {
      if (i === usersToGenerate+startingIndex-1) {
        LOGGER.info(`Waiting for a bit to see if connections take hold`)
        await sleep(30000)
      }
      const snapshot = await generateSnapshot(runData)
      runData.snapshots.push(snapshot)
    }
  }

  storeRunData(runData)

  return runData
}