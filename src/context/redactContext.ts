import { Context, ContextWithSecrets } from './types'
import { redactUser } from '../user'

export const redactContext = (context: ContextWithSecrets): Context => ({
  ...context,
  user: redactUser(context.user),
})
