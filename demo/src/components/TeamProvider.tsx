import * as React from 'react'
import { Team } from '@localfirst/auth'

const TeamContext = React.createContext<TeamContextPayload>(undefined)

export const useTeam = () => {
  const context = React.useContext(TeamContext)
  if (context === undefined) throw new Error(`useTeam must be used within a TeamProvider`)
  const [team, setTeam] = context

  return { team, setTeam }
}

export const TeamProvider: React.FC<{ value: Team | undefined }> = props => {
  const { value, ...otherProps } = props
  const [team, setTeam] = React.useState(value)
  const contextValue = React.useMemo(() => [team, setTeam] as TeamContextPayload, [team])
  return <TeamContext.Provider {...otherProps} value={contextValue} />
}

type TeamContextPayload = [Team | undefined, React.Dispatch<React.SetStateAction<Team>>] | undefined
