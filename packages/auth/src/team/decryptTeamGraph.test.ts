import { setup } from '@/util/testing'
import { load } from './load'

describe('decryptTeamGraph', () => {
  it('deserializes a team after team keys have been rotated', () => {
    const { alice } = setup('alice', 'bob')

    // We start with generation 0 keys
    expect(alice.team.teamKeys().generation).toBe(0)

    // Alice removes Bob, triggering a key rotation
    alice.team.remove('bob')
    expect(alice.team.teamKeys().generation).toBe(1)

    // Alice does some other stuff — say she adds a role
    alice.team.addRole('managers')

    // We now have generation 1 keys
    expect(alice.team.teamKeys().generation).toBe(1)

    // Alice saves the team
    const savedChain = alice.team.save()

    // Even though the team is saved with multiple generations of keys,
    // we can still decrypt it starting with only the original keys
    const originalTeamKeys = alice.team.teamKeys(0)
    const restoredTeam = load(savedChain, alice.localContext, originalTeamKeys)
    expect(restoredTeam.hasRole('managers')).toBe(true)
  })
})
