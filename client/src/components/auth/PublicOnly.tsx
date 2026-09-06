import { Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import { useAuthStore } from '../../store/authStore';

/** Keeps signed-in members inside the workspace instead of sending them back
 * through splash or authentication screens. */
export const PublicOnly = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return isAuthenticated ? <Navigate to={ROUTES.app.myChamas} replace /> : <Outlet />;
};
