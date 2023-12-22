import type { Repo } from '@automerge/automerge-repo'
import { RepoContext } from '@automerge/automerge-repo-react-hooks'
import type * as Auth from '@localfirst/auth'
import type { AuthProvider, ShareId } from '@localfirst/auth-provider-automerge-repo'
import { createContext, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useRootDocumentId } from '../hooks/useRootDocumentId'
import { actions } from '../store/reducer'
import { selectDevice, selectTeamId, selectUser, selectUserName } from '../store/selectors'
import type { AuthState } from '../types'
import { createRepoWithAuth } from '../util/createRepoWithAuth'
import { getRootDocumentIdFromTeam } from '../util/getRootDocumentIdFromTeam'
import { FirstUseSetup } from './FirstUseSetup'
import { FirstUseWrapper } from './FirstUseWrapper'
import { RequestUserName } from './RequestUserName'

const { setDevice, setUser, setTeamId, setUserName, setRootDocumentId } = actions

export const authContext = createContext<AuthState | undefined>(undefined)

export const LocalFirstAuthProvider = ({ children }: Props) => {
  const dispatch = useDispatch()
  const device = useSelector(selectDevice)
  const userName = useSelector(selectUserName)
  const user = useSelector(selectUser)
  const teamId = useSelector(selectTeamId)
  const rootDocumentId = useRootDocumentId()

  const [team, setTeam] = useState<Auth.Team>()
  const [auth, setAuth] = useState<AuthProvider>()
  const [repo, setRepo] = useState<Repo>()

  useEffect(
    () => {
      if (device && user && teamId && rootDocumentId && (!auth || !repo)) {
        // We've used the app before - instantiate the auth provider and the repo.
        createRepoWithAuth(user, device)
          .then(({ auth, repo }) => {
            // Get the team from the auth provider's storage.
            const team = auth.getTeam(teamId)

            const rootDocumentIdFromTeam = getRootDocumentIdFromTeam(team!)
            if (rootDocumentIdFromTeam !== rootDocumentId) {
              throw new Error('team has a different rootDocumentId')
            }
            dispatch(setRootDocumentId(rootDocumentId))
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

  if (!userName)
    return (
      <FirstUseWrapper>
        <RequestUserName
          onSubmit={(userName: string) => {
            dispatch(setUserName(userName))
          }}
        />
      </FirstUseWrapper>
    )

  if (!device || !user || !teamId) {
    // first time using the app: obtain device, user, and team
    return (
      <FirstUseWrapper>
        <FirstUseSetup
          userName={userName}
          onSetup={async ({ device, user, team, auth, repo, rootDocumentId }) => {
            // Store these in local storage
            dispatch(setUser(user))
            dispatch(setDevice(device))
            dispatch(setTeamId(team.id as ShareId))
            dispatch(setRootDocumentId(rootDocumentId))

            // Store these in component state
            setTeam(team)
            setAuth(auth)
            setRepo(repo)
          }}
        />
      </FirstUseWrapper>
    )
  }

  if (rootDocumentId && repo && team && auth) {
    return (
      <authContext.Provider value={{ device, user, team, auth }}>
        <RepoContext.Provider value={repo}>
          {/**/}
          {children}
        </RepoContext.Provider>
      </authContext.Provider>
    )
  }

  return <div>Loading...</div>
}

type Props = {
  userName?: string
  deviceName?: string
  children?: React.ReactNode
}
