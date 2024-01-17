import { DocumentId, Repo } from '@automerge/automerge-repo'
import type * as Auth from '@localfirst/auth'
import { getShareId, type AuthProvider } from '@localfirst/auth-provider-automerge-repo'
import { useState } from 'react'
import { CreateTeam } from './CreateTeam'
import { JoinTeam } from './JoinTeam'
import { RequestUserName } from './RequestUserName'
import { useLocalState } from '../hooks/useLocalState'

/**
 * This is the first time we've used the app. We need a device, a user, and a team.
 * - The device is always created locally.
 * - The user is created locally except when we're joining a team as a new device for an existing
 *   user, in which case we get the user once we've joined.
 * - There are three ways to get a team: (a) use an invitation to join a team as a new member; (b)
 *   use an invitation to join a team as a new device for an existing member; (c) create a new team.
 */
export const FirstUseSetup = ({ onSetup }: Props) => {
  const [state, setState] = useState<State>('SHOW_OPTIONS')
  const { userName, updateLocalState } = useLocalState()

  // We always start by asking for a user name
  if (!userName) return <RequestUserName onSubmit={userName => updateLocalState({ userName })} />

  // Once we have that, we need a team. We can get that by creating one or joining one
  // (as a new member, or as an existing member's device)
  switch (state) {
    case 'SHOW_OPTIONS': {
      return (
        <div className="flex my-8 gap-8 content-center items-center">
          <FirstUseOption
            icon="💌"
            label="Have an invitation code?"
            buttonText="Join a team"
            onClick={() => setState('JOIN_AS_MEMBER')}
            autoFocus
          />
          <FirstUseOption
            icon="📱"
            label="Already joined on another device?"
            buttonText="Authorize this device"
            onClick={() => setState('JOIN_AS_DEVICE')}
          />
          <FirstUseOption
            icon="🙋"
            label="Starting something new?"
            buttonText="Create a team"
            onClick={() => setState('CREATE_TEAM')}
          />
        </div>
      )
    }

    case 'JOIN_AS_MEMBER': {
      return <JoinTeam joinAs="MEMBER" userName={userName} onSetup={onSetup} />
    }

    case 'JOIN_AS_DEVICE': {
      return <JoinTeam joinAs="DEVICE" userName={userName} onSetup={onSetup} />
    }

    case 'CREATE_TEAM': {
      return <CreateTeam userName={userName} onSetup={onSetup} />
    }
  }
}

const FirstUseOption = ({
  icon,
  label,
  buttonText,
  onClick: onSelect,
  autoFocus,
}: FirstUseOptionProps) => {
  return (
    <div className={`p-6`}>
      <div className="flex flex-col space-y-6 text-center basis-1/3">
        <span className="h-12 text-6xl">{icon}</span>
        <p className="h-18">{label}</p>
        <p>
          <button
            className="button button-sm button-primary"
            autoFocus={autoFocus}
            onClick={onSelect}
          >
            {buttonText}
          </button>
        </p>
      </div>
    </div>
  )
}

type Props = {
  onSetup: SetupCallback
}

export type State = 'SHOW_OPTIONS' | 'JOIN_AS_MEMBER' | 'JOIN_AS_DEVICE' | 'CREATE_TEAM'

export type SetupCallback = (args: {
  user: Auth.UserWithSecrets
  device: Auth.DeviceWithSecrets
  team: Auth.Team
  auth: AuthProvider
  repo: Repo
}) => void

type FirstUseOptionProps = {
  icon: string
  label: React.ReactNode
  buttonText: string
  autoFocus?: boolean
  onClick: () => void
  className?: string
}
