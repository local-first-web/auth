import type { Repo } from '@automerge/automerge-repo'
import { RepoContext } from '@automerge/automerge-repo-react-hooks'
import type * as Auth from '@localfirst/auth'
import { type AuthProvider } from '@localfirst/auth-provider-automerge-repo'
import { createContext, useEffect, useState } from 'react'
import { useLocalState } from '../hooks/useLocalState'
import type { AuthState } from '../types'
import { createRepoWithAuth } from '../util/createRepoWithAuth'
import { getRootDocumentIdFromTeam } from '../util/getRootDocumentIdFromTeam'
import { Card } from './Card'
import { FirstUseSetup } from './FirstUseSetup'
import { Layout } from './Layout'

export const LocalFirstAuthContext = createContext<AuthState | undefined>(undefined)

export const LocalFirstAuthProvider = ({ children }: Props) => {
  // Persisted state
  const { userName, user, device, shareId, rootDocumentId, updateLocalState } = useLocalState()
  // Local (component) state
  const [team, setTeam] = useState<Auth.Team>()
  const [auth, setAuth] = useState<AuthProvider>()
  const [repo, setRepo] = useState<Repo>()

  // On first render, check for persisted state
  useEffect(
    () => {
      if (device && user && shareId && rootDocumentId && (!auth || !repo)) {
        // We've used the app before - instantiate the auth provider and the repo.
        createRepoWithAuth({ user, device })
          .then(({ auth, repo }) => {
            // Get the team from the auth provider (which will have loaded it from storage).
            const team = auth.getTeam(shareId)

            // Make sure the team has the correct rootDocumentId
            const rootDocumentIdFromTeam = getRootDocumentIdFromTeam(team!)
            if (rootDocumentIdFromTeam !== rootDocumentId) {
              throw new Error('Team has a different rootDocumentId')
            }
            updateLocalState({ rootDocumentId })
            setTeam(team)
            setAuth(auth)
            setRepo(repo)
          })
          .catch(error => {
            throw error as Error
          })
      }
    },
    [] // only run this effect on first render
  )

  if (!userName || !device || !user || !shareId) {
    return (
      <Layout>
        <Card>
          <FirstUseSetup
            onSetup={({ team, auth, repo }) => {
              setTeam(team)
              setAuth(auth)
              setRepo(repo)
            }}
          />
        </Card>
      </Layout>
    )
  }

  if (rootDocumentId && team && auth && repo) {
    return (
      <LocalFirstAuthContext.Provider value={{ device, user, team, auth }}>
        <RepoContext.Provider value={repo}>{children}</RepoContext.Provider>
      </LocalFirstAuthContext.Provider>
    )
  }

  return <div>Loading...</div>
}

type Props = {
  userName?: string
  deviceName?: string
  children?: React.ReactNode
}
