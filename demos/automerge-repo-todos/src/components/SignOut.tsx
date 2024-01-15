import { useLocalState } from '../hooks/useLocalState'

export const SignOut = () => {
  const { signOut } = useLocalState()
  return (
    <button className="button button-primary button-sm" onClick={signOut}>
      Sign out
    </button>
  )
}
