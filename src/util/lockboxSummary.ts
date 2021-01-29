import { Lockbox } from '/lockbox'

export const lockboxSummary = (l: Lockbox) =>
  `${l.recipient.name}: ${l.contents.name} (G${l.contents.generation})`
