import { MemberContext, LocalUserContext } from '/context/types'
import { redactUser } from '/user'

export const redactContext = (context: LocalUserContext): MemberContext => ({
  ...context,
  member: redactUser(context.user),
})
