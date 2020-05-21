import { TeamState } from '/team/types'

export * from './addMember'
export * from './addMemberRoles'
export * from './addRole'
export * from './collectLockboxes'
export * from './postInvitation'
export * from './revokeInvitation'
export * from './revokeMember'
export * from './revokeMemberRole'
export * from './revokeRole'
export * from './setTeamName'

export const compose = (reducers: Reducer[]): Reducer => state =>
  reducers.reduce((state, reducer) => reducer(state), state)

export type Reducer = (state: TeamState) => TeamState
