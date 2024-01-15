import { DocumentId, Repo } from '@automerge/automerge-repo'
import type * as Auth from '@localfirst/auth'
import { getShareId, type AuthProvider } from '@localfirst/auth-provider-automerge-repo'
import { useState } from 'react'
import { CreateTeam } from './CreateTeam'
import { JoinTeam } from './JoinTeam'
import { RequestUserName } from './RequestUserName'
import { useLocalState } from '../hooks/useLocalState'

export const FirstUseSetup = ({ onSetup: _onSetup }: Props) => {
  const [state, setState] = useState<State>('INITIAL')

  const { userName, user, device, shareId, rootDocumentId, updateLocalState } = useLocalState()

  console.log('*** firstUseSetup', { userName, user, device, shareId, rootDocumentId })
  if (!userName) return <RequestUserName onSubmit={userName => updateLocalState({ userName })} />

  const onSetup: SetupCallback = args => {
    const { user, device, team, rootDocumentId } = args
    const shareId = getShareId(team)
    updateLocalState({ user, device, shareId, rootDocumentId })
    _onSetup(args)
  }

  const FirstUseOption = ({
    icon,
    label,
    buttonText,
    autoFocus,
    state,
    className,
  }: {
    icon: string
    label: React.ReactNode
    buttonText: string
    autoFocus?: boolean
    state: State
    className?: string
  }) => (
    <div className={`p-6  ${className}`}>
      <div className="flex flex-col space-y-6 text-center basis-1/3">
        <span className="h-12 text-6xl">{icon}</span>
        <p className="h-18">{label}</p>
        <p>
          <button
            className="button button-sm button-primary"
            autoFocus={autoFocus}
            onClick={() => setState(state)}
          >
            {buttonText}
          </button>
        </p>
      </div>
    </div>
  )

  switch (state) {
    case 'INITIAL': {
      return (
        <div className="flex my-8 gap-8 content-center items-center">
          <FirstUseOption
            icon="💌"
            label="Have an invitation code?"
            buttonText="Join a team"
            autoFocus
            state="JOIN_AS_MEMBER"
          />
          <FirstUseOption
            icon="📱"
            label="Already joined on another device?"
            buttonText="Authorize this device"
            state="JOIN_AS_DEVICE"
          />
          <FirstUseOption
            icon="🙋"
            label="Starting something new?"
            buttonText="Create a team"
            state="CREATE_TEAM"
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
    // No default
  }
}

type Props = {
  onSetup: SetupCallback
}

export type State = 'INITIAL' | 'JOIN_AS_MEMBER' | 'JOIN_AS_DEVICE' | 'CREATE_TEAM'

export type SetupCallback = (args: {
  user: Auth.UserWithSecrets
  device: Auth.DeviceWithSecrets
  team: Auth.Team
  auth: AuthProvider
  repo: Repo
  rootDocumentId: DocumentId
}) => void
