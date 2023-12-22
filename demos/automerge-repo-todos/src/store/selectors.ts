import type { LocalState } from '../types'

export const selectUserName = (s: LocalState) => s.userName
export const selectUser = (s: LocalState) => s.user
export const selectDevice = (s: LocalState) => s.device
export const selectTeamId = (s: LocalState) => s.teamId
export const selectRootDocumentId = (s: LocalState) => s.rootDocumentId
