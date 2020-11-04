import { LocalUserContext } from '/context'
import * as teams from '/team'
import { Team } from '/team'

/** A simple little storage emulator */
export const storage = {
  contents: undefined as string | undefined,
  save: (team: Team) => {
    storage.contents = team.save()
  },
  load: (context: LocalUserContext) => {
    // ignore coverage
    if (storage.contents === undefined) throw new Error('need to save before you can load')
    return teams.load(storage.contents, context)
  },
}
