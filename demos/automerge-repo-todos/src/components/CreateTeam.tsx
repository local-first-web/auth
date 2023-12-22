import { Repo, type PeerId } from '@automerge/automerge-repo'
import { BrowserWebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket'
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb'
import * as Auth from '@localfirst/auth'
import { AuthProvider } from '@localfirst/auth-provider-automerge-repo'
import { debug, eventPromise, pause } from '@localfirst/auth-shared'
import cx from 'classnames'
import { useState } from 'react'
import type { SharedState } from '../types'
import { addServerToTeam } from '../util/addServerToTeam'
import { getSyncServerWebsocketUrl } from '../util/getSyncServer'
import { storeRootDocumentIdOnTeam } from '../util/storeRootDocumentIdOnTeam'
import { type SetupCallback } from './FirstUseSetup'

export const CreateTeam = ({ userName, onSetup }: Props) => {
  const log = debug.extend(`create-team:${userName}`)
  const [teamName, setTeamName] = useState<string>('')

  const createTeam = async () => {
    if (!teamName || teamName.length === 0) return
    const user = Auth.createUser(userName)
    const device = Auth.createDevice(user.userId, 'device')
    const team = Auth.createTeam(teamName, { user, device })

    log('created user', { user: userName, deviceId: device.deviceId })

    const storage = new IndexedDBStorageAdapter()
    const auth = new AuthProvider({ user, device, storage })

    const url = getSyncServerWebsocketUrl()
    const adapter = new BrowserWebSocketClientAdapter(url)
    const authAdapter = auth.wrap(adapter)

    // Create new automerge-repo with websocket adapter
    const repo = new Repo({
      peerId: device.deviceId as PeerId,
      network: [authAdapter],
      storage,
    })

    await Promise.all([
      eventPromise(authAdapter, 'ready'),
      eventPromise(auth, 'ready'),
      eventPromise(repo.networkSubsystem, 'ready'),
    ])

    await addServerToTeam(team)
    await auth.addTeam(team)

    await eventPromise(auth, 'connected')
    await pause(500)

    const handle = repo.create<SharedState>()
    const rootDocumentId = handle.documentId

    handle.change(s => {
      s.todos = []
    })
    const doc = await handle.doc()

    log(`created root document ${rootDocumentId}`)

    storeRootDocumentIdOnTeam(team, rootDocumentId)
    onSetup({ device, user, team, auth, repo, rootDocumentId })
  }

  return (
    <form
      className={cx(['flex flex-col space-y-4 border rounded-md p-6 m-6', 'w-full', 'sm:w-[25em]'])}
      onSubmit={e => {
        e.preventDefault()
        createTeam()
      }}
    >
      <p className="text-center">
        <label htmlFor="teamName">Enter a name for your team:</label>
      </p>

      <div className={cx(['flex w-full ', 'flex-col space-y-2', 'sm:flex-row sm:space-x-2'])}>
        <input
          id="teamName"
          name="teamName"
          type="text"
          autoFocus={true}
          value={teamName}
          onChange={e => setTeamName(e.target.value)}
          className={cx([
            'border py-1 px-3 flex-grow rounded-md font-bold',
            'text-sm',
            'sm:text-base',
          ])}
          placeholder=""
        />
        <button type="button" className="justify-center" onClick={createTeam}>
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
