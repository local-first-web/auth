import { describe, bench } from 'vitest'
import * as Auth from '../index.js'

describe('auth', () => {
  bench('a new member joining', () => {
    const founderUsername = 'founder'
    const founderContext = {
      user: Auth.createUser(founderUsername, founderUsername),
      device: Auth.createDevice({ userId: founderUsername, deviceName: 'laptop' }),
    }
    const teamName = 'Test'
    const team = Auth.createTeam(teamName, founderContext)

    //
    // Add 100 test users
    //

    const usernames = [...new Array(100).keys()].map(i => 'user-' + i)

    for (const username of usernames) {
      const user = Auth.createUser(username, username)
      const device = Auth.createDevice({ userId: username, deviceName: 'dev/' + username })
      team.addForTesting(user, [], Auth.redactDevice(device))
    }

    //
    // Invite new user and have them join
    //

    const { seed } = team.inviteMember({ maxUses: 1000 })

    const username = 'new-user'
    const user = Auth.createUser(username, username)
    const device = Auth.createDevice({ userId: username, deviceName: 'laptop' })
    const proofOfInvitation = Auth.generateProof(seed)

    team.admitMember(proofOfInvitation, Auth.redactKeys(user.keys), user.userName)

    const serializedGraph = team.save()
    const teamKeyring = team.teamKeyring()
    const team2 = new Auth.Team({ source: serializedGraph, context: { user, device }, teamKeyring })

    team2.join(teamKeyring)
  })
})
