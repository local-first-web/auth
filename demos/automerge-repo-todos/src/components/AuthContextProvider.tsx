import type { Repo } from '@automerge/automerge-repo'
import { RepoContext } from '@automerge/automerge-repo-react-hooks'
import type * as Auth from '@localfirst/auth'
import { getShareId, type AuthProvider } from '@localfirst/auth-provider-automerge-repo'
import { createContext, useEffect, useState } from 'react'
import { useLocalState } from '../hooks/useLocalState'
import type { AuthState } from '../types'
import { initializeAuthRepo } from '../util/initializeAuthRepo'
import { Card } from './Card'
import { FirstUseSetup } from './FirstUseSetup'
import { Layout } from './Layout'
import { assert } from '@localfirst/auth-shared'
import { getRootDocumentIdFromTeam } from '../util/getRootDocumentIdFromTeam'

export const AuthContext = createContext<AuthState | undefined>(undefined)

/**
 * To use the app, we need a user, a device, and a team. If we've used the app before,
 * these will be persisted locally. If not, we'll need to create them.
 */
export const AuthContextProvider = ({ children }: Props) => {
  // Persisted state
  const { user, device, shareId, updateLocalState } = useLocalState()

  // Local (component) state
  const [team, setTeam] = useState<Auth.Team>()
  const [auth, setAuth] = useState<AuthProvider>()
  const [repo, setRepo] = useState<Repo>()

  // On first render, check local storage for persisted state
  useEffect(
    () => {
      if (device) {
        assert(shareId)
        // We've used the app before - use our existing user & device to instantiate the auth provider and the repo.
        initializeAuthRepo({ user, device }).then(({ auth, repo }) => {
          // Get the team from the auth provider (which will have loaded it from storage).
          const team = auth.getTeam(shareId)
          setTeam(team)
          setAuth(auth)
          setRepo(repo)
        })
      }
    },
    [] // only on first render
  )

  // If we haven't used the app before, we need to create a user & device, and either create or join a team.
  if (!device) {
    return (
      <Layout>
        <Card>
          <FirstUseSetup
            onSetup={({ user, device, team, auth, repo }) => {
              const shareId = getShareId(team)
              const rootDocumentId = getRootDocumentIdFromTeam(team)
              updateLocalState({ user, device, shareId, rootDocumentId })
              setTeam(team)
              setAuth(auth)
              setRepo(repo)
            }}
          />
        </Card>
      </Layout>
    )
  }

  if (user && team && auth && repo) {
    return (
      <RepoContext.Provider value={repo}>
        <AuthContext.Provider value={{ device, user, team, auth }}>
          <>{children}</>
        </AuthContext.Provider>
      </RepoContext.Provider>
    )
  }

  return <div>Loading...</div>
}

type Props = {
  userName?: string
  deviceName?: string
  children?: React.ReactNode
}
