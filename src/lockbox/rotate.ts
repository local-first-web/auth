import { KeysWithSecrets } from '/keys'
import { Lockbox } from '/lockbox/types'
import { create } from './create'

export const rotate = (oldLockbox: Lockbox, contents: KeysWithSecrets): Lockbox => {
  // make sure new keys have the same scope and name as the old lockbox
  if (contents.scope !== oldLockbox.contents.scope || contents.name !== oldLockbox.contents.name)
    throw new Error('The scope and name of the new contents must match those of the old lockbox')

  // increment the keys' generation index
  const prevGeneration = oldLockbox.contents.generation || 0
  const newContents = {
    ...contents,
    generation: prevGeneration + 1,
  }

  const newLockbox = create(newContents, oldLockbox.recipient)
  return newLockbox
}
