import * as Auth from '@localfirst/auth'
import cx from 'classnames'
import { useState } from 'react'
import { createRepoWithAuth } from '../util/createRepoWithAuth'
import { getRootDocumentIdFromTeam } from '../util/getRootDocumentIdFromTeam'
import type { SetupCallback } from './FirstUseSetup'
import { createDevice } from '../util/createDevice'
import { parseInvitationCode } from '../util/parseInvitationCode'

export const JoinAsMember = ({ userName, onSetup }: Props) => {
  const [invitationCode, setInvitationCode] = useState<string>('')

  const joinTeam = async () => {
    // First use - create new user and device
    const user = Auth.createUser(userName) as Auth.UserWithSecrets
    const device = createDevice(user.userId)

    const { auth, repo } = await createRepoWithAuth({ user, device })

    const { shareId, invitationSeed } = parseInvitationCode(invitationCode)
    await auth.addInvitation({ shareId, invitationSeed })

    // Once we're admitted to the team, we'll get the Team data
    auth.once('joined', ({ team }) => {
      const rootDocumentId = getRootDocumentIdFromTeam(team)
      if (!rootDocumentId) throw new Error('No root document ID found on team')

      onSetup({ device, user, team, auth, repo, rootDocumentId })
    })
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
