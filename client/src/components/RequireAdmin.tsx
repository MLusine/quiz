import { useLocation , Navigate} from "react-router-dom";
import useAdminAuth from "../hooks/useAdminAuth";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { loading, admin } = useAdminAuth();
  const location = useLocation();
  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!admin)
    return (
      <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
    );
  return <>{children}</>;
}