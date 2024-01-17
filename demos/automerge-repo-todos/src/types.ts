import { AutomergeUrl, DocumentId } from '@automerge/automerge-repo'
import * as Auth from '@localfirst/auth'
import { AuthProvider, ShareId } from '@localfirst/auth-provider-automerge-repo'

/** Inside an Automerge change function, any arrays found on the document have these utility functions */
export interface ExtendedArray<T> extends Array<T> {
  insertAt(index: number, ...args: T[]): ExtendedArray<T>
  deleteAt(index: number, numDelete?: number): ExtendedArray<T>
}

export interface SharedState {
  todos: AutomergeUrl[]
}

export interface TodoData {
  url: AutomergeUrl
  content: string
  completed: boolean
}

export const Filter = {
  all: 'all',
  incomplete: 'incomplete',
  completed: 'completed',
} as const
export type Filter = (typeof Filter)[keyof typeof Filter]

/** LocalState contains any non-shared state data that we want to persist in local storage.  */
export type LocalState = {
  userName?: string // the user's name (not the same as the user's id)
  device?: Auth.DeviceWithSecrets // the local lf/auth device
  user?: Auth.UserWithSecrets // the local lf/auth user
  shareId?: ShareId // truncated lf/auth team id
  rootDocumentId?: DocumentId
}

/** AuthState contains data about our @localfirst/auth user, device, and team */
export type AuthState = {
  device: Auth.DeviceWithSecrets
  user: Auth.UserWithSecrets
  team: Auth.Team
  auth: AuthProvider
}
