import type * as Auth from "@localfirst/auth"
import { getSyncServerUrl, getSyncServerDomain } from "./getSyncServer"

export const addServerToTeam = async (team: Auth.Team) => {
  const url = getSyncServerUrl()

  // get the server's public keys
  const response = await fetch(`${url}/keys`)
  const keys = (await response.json()) as Auth.Keyset

  // add the server's public keys to the team
  team.addServer({ host: getSyncServerDomain(), keys })

  // register the team with the server
  await fetch(`${url}/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serializedGraph: team.save(),
      teamKeyring: team.teamKeyring(),
    }),
  })
}
