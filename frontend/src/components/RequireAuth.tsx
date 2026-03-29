import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function RequireAuth(props: { children: React.ReactNode }) {
  const auth = useAuth()

  if (auth.state.status === 'loading') {
    return <div className="page">...</div>
  }

  if (auth.state.status !== 'authenticated') {
    return <Navigate to="/login" replace />
  }

  return <>{props.children}</>
}
