import type * as Auth from '@localfirst/auth'
import { useState } from 'react'
import { JoinAsDevice } from './JoinAsDevice'
import { CreateTeam } from './CreateTeam'
import { JoinAsMember } from './JoinAsMember'
import type { DocumentId, Repo } from '@automerge/automerge-repo'
import type { AuthProvider } from '@localfirst/auth-provider-automerge-repo'

export const FirstUseSetup = ({ userName, onSetup }: Props) => {
  const [state, setState] = useState<State>('INITIAL')

  const Card = ({
    icon,
    label,
    buttonText,
    state,
    className,
  }: {
    icon: string
    label: React.ReactNode
    buttonText: string
    state: State
    className?: string
  }) => (
    <div className={` p-6 ${className}`}>
      <div className="text-center basis-1/3">
        <span className="text-6xl">{icon}</span>
        <p>{label}</p>
        <button
          className="my-4 w-full text-center"
          autoFocus={true}
          onClick={() => setState(state)}
        >
          {buttonText}
        </button>
      </div>
    </div>
  )

  switch (state) {
    case 'INITIAL': {
      return (
        <div className="flex my-8 gap-8 content-center items-center">
          <Card
            icon="💌"
            label="Have an invitation code?"
            buttonText="Join a team"
            state="JOIN_AS_MEMBER"
          />
          <Card
            icon="📱"
            label="Already joined on another device?"
            buttonText="Authorize this device"
            state="JOIN_AS_DEVICE"
          />
          <Card
            icon="🙋"
            label="Starting something new?"
            buttonText="Create a team"
            state="CREATE_TEAM"
          />
        </div>
      )
    }

    case 'JOIN_AS_MEMBER': {
      return <JoinAsMember userName={userName} onSetup={onSetup} />
    }

    case 'JOIN_AS_DEVICE': {
      return <JoinAsDevice userName={userName} onSetup={onSetup} />
    }

    case 'CREATE_TEAM': {
      return <CreateTeam userName={userName} onSetup={onSetup} />
    }
    // No default
  }
}

type Props = {
  userName: string
  onSetup: SetupCallback
}

export type State = 'INITIAL' | 'JOIN_AS_MEMBER' | 'JOIN_AS_DEVICE' | 'CREATE_TEAM'

export type SetupCallback = (args: {
  device: Auth.DeviceWithSecrets
  user: Auth.UserWithSecrets
  team: Auth.Team
  auth: AuthProvider
  repo: Repo
  rootDocumentId: DocumentId
}) => void
