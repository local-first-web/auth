import { stringifyAutomergeUrl, type AutomergeUrl } from '@automerge/automerge-repo'
import { useDocument } from '@automerge/automerge-repo-react-hooks'
import { assert } from '@localfirst/shared'
import { type SharedState } from '../types'
import { useLocalState } from './useLocalState'

export const useRootDocument = () => {
  const { rootDocumentId } = useLocalState()
  assert(rootDocumentId)
  const rootDocumentUrl: AutomergeUrl = stringifyAutomergeUrl({
    documentId: rootDocumentId,
  })
  return useDocument<SharedState>(rootDocumentUrl)
}
