import { stringifyAutomergeUrl, type AutomergeUrl } from '@automerge/automerge-repo'
import { useDocument } from '@automerge/automerge-repo-react-hooks'
import { assert } from '@localfirst/auth-shared'
import { useSelector } from 'react-redux'
import { selectRootDocumentId } from '../store/selectors'
import { type SharedState } from '../types'

export const useRootDocumentId = () => useSelector(selectRootDocumentId)

export const useRootDocument = () => {
  const rootDocumentId = useRootDocumentId()
  assert(rootDocumentId)
  const rootDocumentUrl: AutomergeUrl = stringifyAutomergeUrl({
    documentId: rootDocumentId,
  })
  return useDocument<SharedState>(rootDocumentUrl)
}
