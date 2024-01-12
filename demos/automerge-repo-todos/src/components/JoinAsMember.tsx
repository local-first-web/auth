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
    // First use - create new user and device
    const user = Auth.createUser(userName) as Auth.UserWithSecrets
    const device = Auth.createDevice(user.userId, 'device')

    const { auth, repo } = await createRepoWithAuth(user, device)

    const teamId = invitationCode.slice(0, 12) // because a ShareId is 12 characters long - see getShareId
    const invitationSeed = invitationCode.slice(12) // the rest of the code is the invitation seed
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
      className={cx(['flex flex-col space-y-4 p-4'])}
      onSubmit={async e => {
        e.preventDefault()
        await joinTeam()
      }}
    >
      <p className="text-center">
        <label htmlFor="invitationCode">Enter your invitation code:</label>
      </p>

      <div className={cx(['flex flex-col space-y-2', 'sm:flex-row sm:space-x-2 sm:space-y-0'])}>
        <input
          id="invitationCode"
          name="invitationCode"
          type="text"
          autoFocus={true}
          value={invitationCode}
          onChange={e => setInvitationCode(e.target.value)}
          className="textbox-auth flex-grow"
          placeholder=""
        />
        <button
          type="button"
          className="button button-sm button-primary justify-center sm:justify-stretch"
          onClick={joinTeam}
        >
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
