import { DEFAULT_INVITATION_VALID_FOR_MS, InviteService } from "../../auth/services/invites/inviteService.js";
import { DeviceService } from "../../auth/services/members/deviceService.js";
import { EVENTS, Networking } from "../../network.js";
import { sleep } from "../../utils/utils.js";
import { generateDeviceName } from "./devices.js";
import { RunData } from "./runData.js";
import { createTeam, joinTeam } from "./team.js";

export async function createFounderAndChain(
  runData: RunData
): Promise<Networking> {
  const ownerStartTimeMs = Date.now()
  const foundingUsername = 'founding-perf-user';
  const founder = await createTeam(runData.teamName, foundingUsername);
  const ownerLoadTimeMs = Date.now() - ownerStartTimeMs
  runData.runMetadata.set(foundingUsername, { 
    chainLoadTimeMs: ownerLoadTimeMs,
    memberCount: 0, 
    deviceCount: 0, 
    memberDiff: 0, 
    deviceDiff: 0,
    connectedPeers: 0
  })
  console.log(`Took owner ${ownerLoadTimeMs}ms to create the chain`)

  runData.peerAddresses.add(founder.libp2p.libp2p!.getMultiaddrs()[0].toString())

  return founder
}

async function waitForDial(user: Networking, startTimeMs: number, runData: RunData): Promise<Networking> {
  let dialFinished = false
  user.events.on(EVENTS.DIAL_FINISHED, () => {
    console.log('Dial finished!')
    dialFinished = true
  })

  let initialized: boolean = false
  user.events.on(EVENTS.INITIALIZED_CHAIN, () => {
    if (initialized) return

    const username = user.storage.getContext()!.user.userName
    const userLoadTimeMs = Date.now() - startTimeMs
    console.log(`Took user ${username} ${userLoadTimeMs}ms to load the chain`)
    console.log(`User ${username} has initialized their chain!`)
    initialized = true
    runData.runMetadata.set(username, { 
      chainLoadTimeMs: userLoadTimeMs, 
      memberCount: 0, 
      deviceCount: 0, 
      memberDiff: 0, 
      deviceDiff: 0,
      connectedPeers: 0
    })

    const deviceName = generateDeviceName(username, 2)
    const newDevice = DeviceService.generateDeviceForUser(user.storage.getContext()!.user.userId, deviceName)
    const inviteForDevice = user.storage.getSigChain()!.invites.createForDevice(DEFAULT_INVITATION_VALID_FOR_MS)
    const deviceProof = InviteService.generateProof(inviteForDevice.seed)
    user.storage.getSigChain()!.invites.admitDevice(deviceProof, newDevice)
    user.events.emit(EVENTS.INITIALIZED_CHAIN) 
  })

  console.log(`Connecting to ${runData.peerAddresses.size} peers`);
  try { 
    await user.libp2p.dial(runData.peerAddresses);
  } catch (e) {
    console.error(`Failed to dial peers on ${user.libp2p.peerId}`, e)
    return user
  }
  

  if (!dialFinished || !initialized) {
    console.log(`Waiting for user to be ready!`)
    while (!dialFinished || !initialized) {
      process.stdout.write('-')
      await sleep(250)
    }
    console.log('\n')
  }

  return user
}

export async function createUserAndDial(
  userIndex: number, 
  inviteSeed: string, 
  runData: RunData
): Promise<Networking> {
  const startTimeMs = Date.now()
  const username = `perf-user-${userIndex}`;
  console.log(`Creating user ${username}`)
  const user = await joinTeam(runData.teamName, username, inviteSeed);
  return waitForDial(user, startTimeMs, runData)
}