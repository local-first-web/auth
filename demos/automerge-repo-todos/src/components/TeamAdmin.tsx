import { useAuth } from '../hooks/useAuth'
import { Invite } from './Invite'
import { TeamMembers } from './TeamMembers'

export const TeamAdmin = () => {
  const authState = useAuth()

  return (
    <div className="flex flex-col space-y-4">
      <Invite />
      <TeamMembers />
    </div>
  )
}
