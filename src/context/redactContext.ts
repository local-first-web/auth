import { LocalUserContext, MemberContext } from '/context/types'
import { redact as redactDevice } from '/device'
import { redact as redactUser } from '/user'

export const redactContext = (context: LocalUserContext): MemberContext => {
  const { client, user } = context
  return {
    member: redactUser(user),
    device: redactDevice(user.device),
    client,
  }
}
