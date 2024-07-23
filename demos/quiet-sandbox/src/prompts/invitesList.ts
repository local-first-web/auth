import actionSelect from "../components/actionSelect.js";
import { invites } from "../data/testTeamInfo.js";

export default async () => {
  let exit = false;
  while (exit === false) {
    const answer = await actionSelect({
      message: "Select an invite",
      choices: invites.map((invite) => {
        return {
          name: `${invite.type} invite ${invite.id} - TTL: ${invite.ttl}`,
          value: invite.id,
        };
      }),
      actions: [
        { name: "Select", value: "select", key: "e" },
        { name: "Back", value: "back", key: "q" },
        { name: "Revoke", value: "revoke", key: "r" },
        { name: "Copy Link", value: "copy", key: "c" },
      ],
    });
    switch (answer.action) {
      case "select":
      case undefined:
        const invite = invites.find((invite) => invite.id === answer.answer);
        console.table(invite);
        break;
      case "back":
        exit = true;
        return;
      case "revoke":
        console.log("Revoke invite");
        break;
      case "copy":
        console.log("Copy invite link");
        break;
    }
  }
}
