import { stringifyAutomergeUrl, type AutomergeUrl } from '@automerge/automerge-repo'
import { useDocument } from '@automerge/automerge-repo-react-hooks'
import { type SharedState } from '../types'
import { assert } from '@localfirst/auth-shared'
import { useRootDocumentId } from './useRootDocumentId'

export const useRootDocument = () => {
  const rootDocumentId = useRootDocumentId()
  assert(rootDocumentId)
  const rootDocumentUrl: AutomergeUrl = stringifyAutomergeUrl({
    documentId: rootDocumentId,
  })
  return useDocument<SharedState>(rootDocumentUrl)
}
