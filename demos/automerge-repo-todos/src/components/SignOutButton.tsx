import { useLocalState } from '../hooks/useLocalState'

export const SignOutButton = () => {
  const { signOut } = useLocalState()
  return (
    <button className="button button-primary button-sm" onClick={signOut}>
      Sign out
    </button>
  )
}
