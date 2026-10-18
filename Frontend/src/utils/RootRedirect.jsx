import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/authContext";
import SessionUnavailable from "./SessionUnavailable";

const ROLE_HOME = {
  admin: "/admin-dashboard",
  employee: "/employee-dashboard",
  client: "/client-dashboard",
};

const RootRedirect = () => {
  const { user, loading, offline } = useAuth();
  const location = useLocation();

  if (location.pathname !== "/") return null;

  if (loading) return null;

  if (!user) {
    if (offline && localStorage.getItem("token")) return <SessionUnavailable />;
    return <Navigate to="/login" replace />;
  }

  // Unknown or missing role -> login
  return <Navigate to={ROLE_HOME[user.role] || "/login"} replace />;
};

export default RootRedirect;
