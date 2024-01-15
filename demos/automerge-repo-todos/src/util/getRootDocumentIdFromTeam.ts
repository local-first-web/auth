import type { DocumentId } from "@automerge/automerge-repo"
import type * as Auth from "@localfirst/auth"

export const getRootDocumentIdFromTeam = (
  team: Auth.Team
): DocumentId | undefined => {
  // find the last message of type ROOT_DOCUMENT_ID
  return team
    .messages<TeamMessage>()
    .filter(message => message.type === "ROOT_DOCUMENT_ID")
    .pop()?.payload
}

export type TeamMessage = {
  type: "ROOT_DOCUMENT_ID"
  payload: DocumentId
}
