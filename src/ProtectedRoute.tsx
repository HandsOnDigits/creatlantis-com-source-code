import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth, AuthStatus } from './AuthContext'

function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === AuthStatus.Loading) {
    return <p>Checking authentication...</p>
  }

  if (status === AuthStatus.Error) {
    return (
      <div>
        <p>Unable to restore your session.</p>
        <button onClick={() => window.location.reload()}>Try again</button>
      </div>
    )
  }

  if (status !== AuthStatus.Authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

export default ProtectedRoute
