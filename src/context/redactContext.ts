import { MemberContext, LocalUserContext } from '/context/types'
import { redact } from '/user'

export const redactContext = (context: LocalUserContext): MemberContext => {
  const { client, user } = context
  const { userName, device } = user
  return {
    member: redact(user),
    device: {
      name: device.name,
      type: device.type,
      userName,
    },
    client,
  }
}
