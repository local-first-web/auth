import { TeamState } from '/team/types'

export * from '/team/transforms/addMember'
export * from '/team/transforms/addMemberRoles'
export * from '/team/transforms/addRole'
export * from '/team/transforms/collectLockboxes'
export * from '/team/transforms/postInvitation'
export * from '/team/transforms/revokeInvitation'
export * from '/team/transforms/revokeMember'
export * from '/team/transforms/revokeMemberRole'
export * from '/team/transforms/revokeRole'
export * from '/team/transforms/setTeamName'

export const compose = (transforms: Transform[]): Transform => (state) =>
  transforms.reduce((state, transform) => transform(state), state)

export type Transform = (state: TeamState) => TeamState
