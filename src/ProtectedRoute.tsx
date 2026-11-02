import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <p>Checking authentication...</p>
  }

  if (status === 'error') {
    return (
      <div>
        <p>Unable to restore your session.</p>
        <button onClick={() => window.location.reload()}>Try again</button>
      </div>
    )
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

export default ProtectedRoute
