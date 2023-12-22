import type { DocumentId } from "@automerge/automerge-repo"
import type * as Auth from "@localfirst/auth"

export const storeRootDocumentIdOnTeam = (team: Auth.Team, id: DocumentId) => {
  team.addMessage({ type: "ROOT_DOCUMENT_ID", payload: id })
}
