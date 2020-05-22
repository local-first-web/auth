import { TeamState } from '/team/types'

export * from '/team/reducers/addMember'
export * from '/team/reducers/addMemberRoles'
export * from '/team/reducers/addRole'
export * from '/team/reducers/collectLockboxes'
export * from '/team/reducers/postInvitation'
export * from '/team/reducers/revokeInvitation'
export * from '/team/reducers/revokeMember'
export * from '/team/reducers/revokeMemberRole'
export * from '/team/reducers/revokeRole'
export * from '/team/reducers/setTeamName'

export const compose = (reducers: Reducer[]): Reducer => state =>
  reducers.reduce((state, reducer) => reducer(state), state)

export type Reducer = (state: TeamState) => TeamState
