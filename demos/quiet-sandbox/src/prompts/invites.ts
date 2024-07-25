import { input } from "@inquirer/prompts";
import { InvitationState } from "@localfirst/auth";
import clipboard from 'clipboardy';

import actionSelect from "../components/actionSelect.js";
import { Storage } from "../network.js";
import { DEFAULT_INVITATION_VALID_FOR_MS, DEFAULT_MAX_USES } from "../auth/services/invites/inviteService.js";

export const INVITE_TABLE_PROPERTIES = ['id', 'seed', 'publicKey', 'expiration', 'maxUses', 'userId', 'uses', 'revoked']
const inviteSeedMap = new Map<string, string>()

const invitesList = async (storage: Storage) => {
  let exit = false;
  while (exit === false) {
    const sigChain = storage.getSigChain()!
    const invites = sigChain.invites.getAllInvites()
    if (invites.length === 0) {
      console.log(`No invites found for team ${sigChain.team.teamName}`)
      return
    }

    const answer = await actionSelect({
      message: "Select an invite",
      choices: invites.map((invite: InvitationState) => {
        return {
          name: `${invite.id} (Remaining Uses: ${invite.maxUses - invite.uses}, Expiry: ${invite.expiration}, Revoked?: ${invite.revoked})`,
          value: invite.id,
        };
      }),
      actions: [
        { name: "Select", value: "select", key: "e" },
        { name: "Back", value: "back", key: "q" },
        { name: "Revoke", value: "revoke", key: "r" },
        { name: "Copy Seed", value: "copy", key: "c" },
      ],
    });
    const invite = invites.find((invite) => invite.id === answer.answer)!;
    switch (answer.action) {
      case "select":
      case undefined:
        console.table([createTableInvite(invite)], INVITE_TABLE_PROPERTIES);
        break;
      case "revoke":
        console.log(`Revoking invite with ID ${invite.id}`);
        storage.getSigChain()!.invites.revoke(invite.id)
        const newInviteState = storage.getSigChain()!.invites.getById(invite.id)
        console.table([createTableInvite(newInviteState)], INVITE_TABLE_PROPERTIES)
        break;
      case "copy":
        console.log(`Copying seed for invite with ID ${invite.id}`);
        const seed = inviteSeedMap.get(invite.id)
        if (seed == null) {
          console.warn(`No seed found for invite with ID ${invite.id}`)
        } else {
          await clipboard.write(seed)
          if (await clipboard.read() === seed) {
            console.log('Copied!')
          } else {
            console.warn('Copy failed!')
          }
        }
        break;
      case "back":
        exit = true;
        return;
    }
  }
}

const inviteAdd = async (storage: Storage) => {
  if (storage.getSigChain() == null) {
    console.warn("Must setup team before creating invites!")
    return storage
  }

  const sigChain = storage.getSigChain()!

  const validForMs = await input({
    message: "How long, in milliseconds, should this invite be valid for?",
    default: DEFAULT_INVITATION_VALID_FOR_MS.toString(),
  });
  const maxUses = await input({
    message: "How many times can this invite be used?",
    default: DEFAULT_MAX_USES.toString()
  });
  const invite = sigChain.invites.create(Number(validForMs), Number(maxUses))
  console.log(`Created new invite with seed ${invite.seed}`)
  inviteSeedMap.set(invite.id, invite.seed)

  return invite
}

const createTableInvite = (invite: InvitationState): InvitationState & { seed: string | undefined } => {
  return {
    ...invite,
    seed: inviteSeedMap.get(invite.id) || undefined 
  }
}

export {
  invitesList,
  inviteAdd
}
