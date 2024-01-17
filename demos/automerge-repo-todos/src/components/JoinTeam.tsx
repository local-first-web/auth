import * as Auth from '@localfirst/auth'
import cx from 'classnames'
import { useState } from 'react'
import { createDevice } from '../util/createDevice'
import { initializeAuthRepo } from '../util/initializeAuthRepo'
import { parseInvitationCode } from '../util/parseInvitationCode'
import type { SetupCallback } from './FirstUseSetup'

export const JoinTeam = ({ joinAs, userName, onSetup }: Props) => {
  const [invitationCode, setInvitationCode] = useState<string>('')

  const getUserAndDevice = () => {
    if (joinAs === 'MEMBER') {
      // Create new user and device
      const user = Auth.createUser(userName) as Auth.UserWithSecrets
      const device = createDevice(user.userId)
      return { user, device }
    } else {
      // Create new device (our user has already been created on another device)
      const device = createDevice(userName) // we'll temporarily use the userName instead of the userId
      return { device }
    }
  }
  const joinTeam = async () => {
    const { user, device } = getUserAndDevice()
    const { auth, repo } = await initializeAuthRepo({ user, device })

    const { shareId, invitationSeed } = parseInvitationCode(invitationCode)
    auth.addInvitation({ shareId, invitationSeed, userName })

    // Once we're admitted, we'll get the Team data and our User object
    auth.once('joined', ({ team, user }) => {
      // Now we have our real userId, we can update the device
      device.userId = user.userId

      onSetup({ device, user, team, auth, repo })
    })
  }

  return (
    <form
      className={cx(['flex flex-col space-y-4 p-4'])}
      onSubmit={async e => {
        e.preventDefault()
        joinTeam()
      }}
    >
      <p className="text-center">
        <label htmlFor="invitationCode">Enter your invitation code:</label>
      </p>

      <div className="flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
        <input
          type="text"
          className="textbox-auth flex-grow"
          id="invitationCode"
          name="invitationCode"
          autoFocus
          value={invitationCode}
          onChange={e => setInvitationCode(e.target.value)}
        />
        <button
          type="submit"
          className="button button-sm button-primary justify-center sm:justify-stretch"
        >
          Join team
        </button>
      </div>
    </form>
  )
}

type Props = {
  joinAs: 'MEMBER' | 'DEVICE'
  userName: string
  onSetup: SetupCallback
}
