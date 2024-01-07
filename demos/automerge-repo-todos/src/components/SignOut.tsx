import { useDispatch } from 'react-redux'
import { actions } from '../store/reducer'
const { logout } = actions

export const SignOut = () => {
  const dispatch = useDispatch()
  const signOut = () => {
    dispatch(logout())
  }
  return (
    <button className="button button-primary button-sm" onClick={signOut}>
      Sign out
    </button>
  )
}
