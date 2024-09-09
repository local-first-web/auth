import { DEFAULT_INVITATION_VALID_FOR_MS, InviteService } from "../../auth/services/invites/inviteService.js";
import { DeviceService } from "../../auth/services/members/deviceService.js";
import { EVENTS, QuietAuthEvents } from "../../network/events.js";
import { Networking } from "../../network/network.js";
import { sleep } from "../../utils/utils.js";
import { generateDeviceName } from "./devices.js";
import { createLogger } from "./logger.js";
import { RunData } from "./runData.js";
import { createTeam, joinTeam, preJoin } from "./team.js";

const LOGGER = createLogger("users")

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
  LOGGER.info(
    `Took owner ${ownerLoadTimeMs}ms to create the chain`, 
    { username: foundingUsername, peerId: founder.libp2p.peerId }
  )

  runData.peerAddresses.add(founder.libp2p.libp2p!.getMultiaddrs()[0].toString())

  return founder
}

async function waitForDial(user: Networking, startTimeMs: number, runData: RunData): Promise<Networking> {
  const loggerData = { username: user.storage.getContext()!.user.userName, peerId: user.libp2p.peerId }
  // let dialFinished = false
  // user.events.on(EVENTS.DIAL_FINISHED, () => {
  //   if ()
  //   LOGGER.info('Dial finished!', loggerData)
  //   dialFinished = true
  // })

  let initialized: boolean = false
  user.events.on(EVENTS.INITIALIZED_CHAIN, () => {
    if (initialized) return

    const username = user.storage.getContext()!.user.userName
    const userLoadTimeMs = Date.now() - startTimeMs
    LOGGER.info(`Took user ${username} ${userLoadTimeMs}ms to load the chain`, loggerData)
    LOGGER.info(`User ${username} has initialized their chain!`, loggerData)
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

  // let attempts = 5
  // while (attempts > 0) {
  //   try {
  //     LOGGER.info(`Connecting to ${runData.peerAddresses.size} peers`, loggerData);
  //     try { 
  //       await user.libp2p.dial(runData.peerAddresses);
  //     } catch (e) {
  //       LOGGER.error(`Failed to dial peers on ${user.libp2p.peerId}`, loggerData, e)
  //       return user
  //     }
      
  //     if (!dialFinished || !initialized) {
  //       const waitIntervalMs = 250
  //       const waitTimeMs = 60_000
  //       const waitEndTimeMs = Date.now() + waitTimeMs
  //       LOGGER.info(`Waiting for user to be ready!`, loggerData)
  //       while ((!dialFinished || !initialized) && Date.now() < waitEndTimeMs) {
  //         process.stdout.write('-')
  //         await sleep(waitIntervalMs)
  //       }
  //       if (!dialFinished || !initialized) {
  //         throw new Error(`Failed to finishing dialing in ${waitEndTimeMs}ms timeout`)
  //       }
  //       console.log('\n')
  //     }
  //     return user
  //   } catch (e) {
  //     LOGGER.error(`Failed to dial peers for user ${user.storage.getContext()!.user.userName}`, loggerData, e)
  //     await user.libp2p.hangUpOnAll()
  //     attempts -= 1
  //   }
  // }      

  // throw new Error(`Failed to initialize user ${user.storage.getContext()!.user.userName}`)
  if (!initialized) {
    const waitIntervalMs = 250
    const waitTimeMs = 60_000
    const waitEndTimeMs = Date.now() + waitTimeMs
    LOGGER.info(`Waiting for user to be ready!`, loggerData)
    while ((!initialized) && Date.now() < waitEndTimeMs) {
      process.stdout.write('-')
      await sleep(waitIntervalMs)
    }
    if (!initialized) {
      throw new Error(`Failed to finish loading chain in ${waitEndTimeMs}ms timeout`)
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
  LOGGER.info(`Creating user ${username}`)

  let initialized: boolean = false
  let dialed: boolean = false
  const events = new QuietAuthEvents(username)

  const storage = preJoin(runData.teamName, username, inviteSeed)
  events.on(EVENTS.INITIALIZED_CHAIN, () => {
    if (initialized) return

    const username = storage.getContext()!.user.userName
    const userLoadTimeMs = Date.now() - startTimeMs
    LOGGER.info(`Took user ${username} ${userLoadTimeMs}ms to load the chain`)
    LOGGER.info(`User ${username} has initialized their chain!`)
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
    const newDevice = DeviceService.generateDeviceForUser(storage.getContext()!.user.userId, deviceName)
    const inviteForDevice = storage.getSigChain()!.invites.createForDevice(DEFAULT_INVITATION_VALID_FOR_MS)
    const deviceProof = InviteService.generateProof(inviteForDevice.seed)
    storage.getSigChain()!.invites.admitDevice(deviceProof, newDevice)
    events.emit(EVENTS.INITIALIZED_CHAIN) 
  })

  const user = await joinTeam(storage, events);
  await sleep(2000)

  if (!initialized && user.storage.getSigChain() != null) {
    user.events.emit(EVENTS.INITIALIZED_CHAIN)
  }

  const minDialAmount = Math.min(3, runData.users.length)
  const hasDialedEnough = (user: Networking): boolean => {
    if (user.libp2p.libp2p && user.libp2p.libp2p?.getPeers().length >= minDialAmount) {
      LOGGER.info(`Connected to ${minDialAmount} peers!  Moving on!`)
      return true
    }

    return false
  }

  dialed = hasDialedEnough(user)

  if (!initialized || !dialed) {
    const waitIntervalMs = 500
    const waitTimeMs = 60_000
    const waitEndTimeMs = Date.now() + waitTimeMs
    LOGGER.info(`Waiting for user ${username} to be ready!`)
    while ((!initialized || !dialed) && Date.now() < waitEndTimeMs) {
      process.stdout.write('-')
      await sleep(waitIntervalMs)
      if (!dialed) {
        dialed = hasDialedEnough(user)
      }
    }
    if (!initialized) {
      throw new Error(`Failed to finish loading chain for ${username} in ${waitTimeMs}ms timeout`)
    }
    console.log('\n')
  }

  return user
}