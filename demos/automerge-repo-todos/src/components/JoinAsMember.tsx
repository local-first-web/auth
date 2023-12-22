import * as Auth from '@localfirst/auth'
import type { ShareId } from '@localfirst/auth-provider-automerge-repo'
import cx from 'classnames'
import { useState } from 'react'
import { createRepoWithAuth } from '../util/createRepoWithAuth'
import { eventPromise } from '@localfirst/auth-shared'
import type { SetupCallback } from './FirstUseSetup'
import { getRootDocumentIdFromTeam } from '../util/getRootDocumentIdFromTeam'

export const JoinAsMember = ({ userName, onSetup }: Props) => {
  const [invitationCode, setInvitationCode] = useState<string>('')

  const joinTeam = async () => {
    // TODO: validate invitation code format

    // First use - create new user and device
    const user = Auth.createUser(userName) as Auth.UserWithSecrets
    const device = Auth.createDevice(user.userId, 'device')

    const { auth, repo } = await createRepoWithAuth(user, device)
    const [teamId, invitationSeed] = invitationCode.split('_')
    const shareId = teamId as ShareId
    await auth.addInvitation({ shareId, invitationSeed })
    await eventPromise(auth, 'connected')

    const team = auth.getTeam(shareId)
    const rootDocumentId = getRootDocumentIdFromTeam(team)
    if (!rootDocumentId) throw new Error('No root document ID found on team')

    onSetup({ device, user, team, auth, repo, rootDocumentId })
  }

  return (
    <form
      className={cx(['flex flex-col space-y-4 border rounded-md p-6 m-6', 'w-full', 'sm:w-[35em]'])}
      onSubmit={async e => {
        e.preventDefault()
        await joinTeam()
      }}
    >
      <p className="text-center">
        <label htmlFor="invitationCode">Enter your invitation code:</label>
      </p>

      <div className={cx(['flex w-full ', 'flex-col space-y-2', 'sm:flex-row sm:space-x-2'])}>
        <input
          id="invitationCode"
          name="invitationCode"
          type="text"
          autoFocus={true}
          value={invitationCode}
          onChange={e => setInvitationCode(e.target.value)}
          className={cx(['border px-3 flex-grow rounded-md font-mono', 'text-xs'])}
          placeholder=""
        />
        <button type="button" className="justify-center" onClick={joinTeam}>
          Join team
        </button>
      </div>
    </form>
  )
}

type Props = {
  userName: string
  onSetup: SetupCallback
}
