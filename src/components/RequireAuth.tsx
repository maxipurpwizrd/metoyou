import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login", {
        replace: true,
        state: {
          from: {
            pathname: location.pathname,
            search: location.search,
          },
        },
      });
    }
  }, [isLoading, user, navigate, location.pathname, location.search]);

  if (isLoading) return null;
  if (!user) return null;
  return <>{children}</>;
}
