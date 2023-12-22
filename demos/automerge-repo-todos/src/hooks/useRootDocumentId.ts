import { useSelector } from "react-redux"
import { selectRootDocumentId } from "../store/selectors"

export const useRootDocumentId = () => useSelector(selectRootDocumentId)
