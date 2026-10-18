import { Navigate } from "react-router-dom";
import { useAuth } from "../context/authContext";
import SessionUnavailable from "./SessionUnavailable";

const PrivateRoutes = ({ children }) => {
  const { user, loading, offline } = useAuth();


  if (loading) return null;

  if (!user) {
    // Token kept but unverifiable (network/5xx) and no cached user: do not log out.
    if (offline && localStorage.getItem("token")) return <SessionUnavailable />;
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default PrivateRoutes;
