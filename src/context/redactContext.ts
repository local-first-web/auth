import { MemberContext, LocalUserContext } from '/context/types'
import { redact } from '/user'

export const redactContext = (context: LocalUserContext): MemberContext => ({
  ...context,
  member: redact(context.user),
})
