import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/authContext";

const RoleBaseRoutes = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();
  const location = useLocation();


  if (loading) {
    return <div>Loading...</div>;
  }

 
  if (!user) {
    return <Navigate to="/login" replace />;
  }

 
  if (!user.role) {
    return <div>Loading...</div>;
  }

  if (!requiredRole.includes(user.role)) {
    const fallbackRoutes = {
      admin: "/admin-dashboard",
      employee: "/employee-dashboard",
      client: "/client-dashboard"
    };

    return (
      <Navigate
        to={fallbackRoutes[user.role] || "/login"}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children;
};

export default RoleBaseRoutes;
