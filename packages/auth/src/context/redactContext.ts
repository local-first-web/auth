import { LocalUserContext, MemberContext } from '@/context/types'
import { redactDevice } from '@/device'
import { redactUser } from '@/team'

export const redactContext = (context: LocalUserContext): MemberContext => {
  const { client, user, device } = context
  return {
    member: redactUser(user),
    device: redactDevice(device),
    client,
  }
}
