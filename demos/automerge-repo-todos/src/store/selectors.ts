import type { LocalState } from '../types'

export const selectUserName = (s: LocalState) => s.userName
export const selectUser = (s: LocalState) => s.user
export const selectDevice = (s: LocalState) => s.device
export const selectShareId = (s: LocalState) => s.shareId
export const selectRootDocumentId = (s: LocalState) => s.rootDocumentId
