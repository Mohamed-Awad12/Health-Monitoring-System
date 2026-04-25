import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { getRoleHomePath } from "../../utils/roleRoutes";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="screen-center">
        <div className="loading-dot" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  return children;
}
