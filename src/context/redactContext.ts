import { Context, ContextWithSecrets } from '/context/types'
import { redactUser } from '/user'

export const redactContext = (context: ContextWithSecrets): Context => ({
  ...context,
  user: redactUser(context.user),
})
