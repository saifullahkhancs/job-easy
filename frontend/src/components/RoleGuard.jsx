import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getCurrentUser } from "../api/client";

const ROLES = {
  VISITOR: "visitor",
  CUSTOMER: "customer",
  ADMIN: "admin",
};

export default function RoleGuard({ allowedRoles, children, fallbackPath = "/app" }) {
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const user = await getCurrentUser();
        setUserRole(user.role);
      } catch (error) {
        setUserRole(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkRole();
  }, []);

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (!userRole || !allowedRoles.includes(userRole)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
}

export { ROLES };
