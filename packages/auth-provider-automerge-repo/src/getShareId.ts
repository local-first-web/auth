import type { Team } from '@localfirst/auth'
import type { ShareId } from './types.js'

/**
 * We use the first few characters of the team ID as the share ID. The team ID is a hash of the team's
 * root node (in base58 form), so it doesn't change.
 *
 * Truncating the team ID makes composite invitation keys (shareId + invitation seed) smaller and
 * thus more human-friendly. The tradeoff is the increased chance of collisions; 12 base58-encoded characters
 * give us 70 bits of entropy; according to [this calculator](https://kevingal.com/apps/collision.html),
 * you'd need to have 100 trillion shareIds on a single device before you'd have a 1% chance of a collision.
 */
export const getShareId = (team: Team): ShareId => {
  const teamId = team.id
  return teamId.slice(0, 12) as ShareId
}
