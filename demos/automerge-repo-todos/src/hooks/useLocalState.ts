import * as Auth from '@localfirst/auth'
import { useLocalStorage } from '@uidotdev/usehooks'
import { LocalState } from '../types'
import { ShareId } from '@localfirst/auth-provider-automerge-repo'
import { DocumentId } from '@automerge/automerge-repo'

export const useLocalState = () => {
  const initialState: LocalState = {}
  const [state, setState] = useLocalStorage('automerge-repo-todos-state', initialState)

  const { userName, user, device, shareId, rootDocumentId } = state
  const updateLocalState = (s: Partial<LocalState>) => setState({ ...state, ...s })
  const signOut = () => setState(initialState)

  return {
    userName,
    user,
    device,
    shareId,
    rootDocumentId,
    updateLocalState,
    signOut,
  }
}
