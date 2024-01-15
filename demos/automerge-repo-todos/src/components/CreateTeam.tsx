import * as Auth from '@localfirst/auth'
import cx from 'classnames'
import { useState } from 'react'
import type { SharedState } from '../types'
import { initializeAuthRepo } from '../util/initializeAuthRepo'
import { storeRootDocumentIdOnTeam } from '../util/storeRootDocumentIdOnTeam'
import { type SetupCallback } from './FirstUseSetup'
import { createDevice } from '../util/createDevice'

export const CreateTeam = ({ userName, onSetup }: Props) => {
  const [teamName, setTeamName] = useState<string>('')

  const createTeam = async () => {
    if (!teamName || teamName.length === 0) return

    // Create new user and device
    const user = Auth.createUser(userName)
    const device = createDevice(user.userId)

    // Create repo and auth provider
    const { auth, repo } = await initializeAuthRepo({ user, device })

    // The auth provider creates a team, registers it with the server, and waits for connection
    const team = await auth.createTeam(teamName)

    // Since this is a new team, we also need to create a new root document.
    const handle = repo.create<SharedState>()
    const rootDocumentId = handle.documentId
    handle.change(s => (s.todos = []))

    // Store the root document ID on the team so other devices can find it
    storeRootDocumentIdOnTeam(team, rootDocumentId)

    onSetup({ device, user, team, auth, repo })
  }

  return (
    <form
      className={cx(['flex flex-col space-y-4 p-4'])}
      onSubmit={e => {
        e.preventDefault()
        createTeam()
      }}
    >
      <p className="text-center">
        <label htmlFor="teamName">Enter a name for your team:</label>
      </p>

      <div className="m-auto flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
        <input
          type="text"
          className="textbox-auth flex-grow"
          id="teamName"
          name="teamName"
          autoFocus
          value={teamName}
          onChange={e => setTeamName(e.target.value)}
        />
        <button type="submit" className="button button-sm button-primary justify-center">
          Create team
        </button>
      </div>
    </form>
  )
}

type Props = {
  userName: string
  onSetup: SetupCallback
}
