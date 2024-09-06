import { InviteeMemberContext } from "@localfirst/auth";
import { SigChain } from "../../auth/chain.js";
import { DEFAULT_INVITATION_VALID_FOR_MS } from "../../auth/services/invites/inviteService.js";
import { UserService } from "../../auth/services/members/userService.js";
import { LocalStorage, Networking, QuietAuthEvents } from "../../network.js";
import { generateDeviceName } from "./devices.js";
import { createLogger } from "./logger.js";

const LOGGER = createLogger("team")

export const createTeam = async (name: string, username: string): Promise<Networking> => {
  LOGGER.info(`Initializing team with name ${name} for user ${username}`);
  const storage = new LocalStorage()
  const loadedSigChain = SigChain.create(name, username);
  storage.setContext(loadedSigChain.context);
  storage.setSigChain(loadedSigChain.sigChain);
  storage.setAuthContext({
    user: loadedSigChain.context.user,
    device: loadedSigChain.context.device,
    team: loadedSigChain.sigChain.team
  });

  LOGGER.info(`Initializing networking`);
  const networking = await Networking.init(storage);
  // await networking.sigChain.writeInitialChain(loadedSigChain.sigChain);
  return networking;
}

export const preJoin = (name: string, username: string, inviteSeed: string): LocalStorage => {
  LOGGER.info(`Creating prerequisites to join team ${name} as user ${username} with inviteSeed ${inviteSeed}`);
  const storage = new LocalStorage()
  const deviceName = generateDeviceName(username, 1)
  const prospectiveUser = UserService.createFromInviteSeed(username, inviteSeed, deviceName)
  storage.setContext(prospectiveUser.context)
  storage.setAuthContext({
    user: prospectiveUser.context.user,
    device: prospectiveUser.context.device,
    invitationSeed: inviteSeed
  });

  return storage
}

export const joinTeam = async (storage: LocalStorage, events?: QuietAuthEvents): Promise<Networking> => {
  LOGGER.info(`Joining team as user ${(storage.getAuthContext()! as InviteeMemberContext).user.userName} with inviteSeed ${(storage.getAuthContext()! as InviteeMemberContext).invitationSeed}`)
  LOGGER.info(`Initializing networking`);
  const networking = await Networking.init(storage, events);

  return networking;
}

export async function createInvites(founder: Networking): Promise<string[]> {
  const inviteCount = 10;
  const inviteMaxUses = 50;
  const inviteSeeds: string[] = [];

  LOGGER.info(`Generating ${inviteCount} invites as founder`);
  for (let i = 0; i < inviteCount; i++) {
    const invite = founder.libp2p.storage.getSigChain()!.invites.create(DEFAULT_INVITATION_VALID_FOR_MS, inviteMaxUses);
    inviteSeeds.push(invite.seed);
  }

  return inviteSeeds
}