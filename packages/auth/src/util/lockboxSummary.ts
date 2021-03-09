import { Lockbox } from '@/lockbox'

export const lockboxSummary = (l: Lockbox) =>
  `${l.recipient.name}(${trunc(l.recipient.publicKey)}):${l.contents.name}#${l.contents.generation}`

const trunc = (s: string) => s.slice(0, 5)
