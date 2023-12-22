import { useContext } from 'react'
import { authContext } from '../components/LocalFirstAuthProvider'

// Convenience wrapper around our authContext for accessing the auth data and provider
export const useAuth = () => {
  const context = useContext(authContext)
  if (context === null) throw new Error('useAuth must be used within a LocalFirstAuthProvider')
  return context
}
