import * as Auth from '@localfirst/auth'
import cx from 'classnames'
import { useState } from 'react'
import type { SharedState } from '../types'
import { createRepoWithAuth } from '../util/createRepoWithAuth'
import { storeRootDocumentIdOnTeam } from '../util/storeRootDocumentIdOnTeam'
import { type SetupCallback } from './FirstUseSetup'

export const CreateTeam = ({ userName, onSetup }: Props) => {
  const [teamName, setTeamName] = useState<string>('')

  const createTeam = async () => {
    if (!teamName || teamName.length === 0) return

    // First use - create new user and device
    const user = Auth.createUser(userName)
    const device = Auth.createDevice(user.userId, 'device')

    // Create repo and auth provider
    const { auth, repo } = await createRepoWithAuth({ user, device })

    // Create team, register it with server, and wait for connection
    const team = await auth.createTeam(teamName)

    // Create root document
    const handle = repo.create<SharedState>()
    const rootDocumentId = handle.documentId
    handle.change(s => (s.todos = []))

    storeRootDocumentIdOnTeam(team, rootDocumentId)
    onSetup({ device, user, team, auth, repo, rootDocumentId })
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

      <div
        className={cx([
          'm-auto',
          'flex flex-col space-y-2',
          'sm:flex-row sm:space-x-2 sm:space-y-0',
        ])}
      >
        <input
          id="teamName"
          name="teamName"
          type="text"
          autoFocus={true}
          value={teamName}
          onChange={e => setTeamName(e.target.value)}
          className="textbox-auth flex-grow"
          placeholder=""
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
