import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { roleHome } from '../auth/roles';

export function RequireRole({ role }: { role: string }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="screen-center">
        <div className="panel panel-narrow">
          <p className="muted">Loading session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  return <Outlet />;
}
