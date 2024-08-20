import { SigChain } from "../../auth/chain.js";
import { UserService } from "../../auth/services/members/userService.js";
import { LocalStorage, Networking } from "../../network.js";
import { generateDeviceName } from "./devices.js";

export const createTeam = async (name: string, username: string): Promise<Networking> => {
  console.log(`Initializing team with name ${name} for user ${username}`);
  const storage = new LocalStorage()
  const loadedSigChain = SigChain.create(name, username);
  storage.setContext(loadedSigChain.context);
  storage.setSigChain(loadedSigChain.sigChain);
  storage.setAuthContext({
    user: loadedSigChain.context.user,
    device: loadedSigChain.context.device,
    team: loadedSigChain.sigChain.team
  });

  console.log(`Initializing networking`);
  const networking = await Networking.init(storage);
  await networking.sigChain.writeInitialChain(loadedSigChain.sigChain);
  return networking;
}

export const joinTeam = async (name: string, username: string, inviteSeed: string, peerAddresses: string[]): Promise<Networking> => {
  console.log(`Joining team ${name} as user ${username} with inviteSeed ${inviteSeed}`);
  const storage = new LocalStorage()
  const deviceName = generateDeviceName(username, 1)
  const prospectiveUser = UserService.createFromInviteSeed(username, inviteSeed, deviceName)
    storage.setContext(prospectiveUser.context)
    storage.setAuthContext({
      user: prospectiveUser.context.user,
      device: prospectiveUser.context.device,
      invitationSeed: inviteSeed
    });

  console.log(`Initializing networking`);
  const networking = await Networking.init(storage);

  return networking;
}