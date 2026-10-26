import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

import { useAuthSession } from "../../auth/model/AuthSession";

interface BoardHeaderProps extends PropsWithChildren {
  title: string;
  subtitle: string;
}

export default function BoardHeader({ title, subtitle, children }: BoardHeaderProps) {
  const { accessToken, setAccessToken } = useAuthSession();
  const { isAuthenticated, logout } = useAuth0();

  const handleLogout = () => {
    setAccessToken(null);
    if (isAuthenticated) {
      void logout({ logoutParams: { returnTo: window.location.origin } });
    }
  };

  return (
    <header className="board-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="board-header-actions">
        {children}
        {accessToken ? (
          <>
            <Link className="board-profile-link" to="/profile">Profile</Link>
            <button className="board-login-link" type="button" onClick={handleLogout}>
              Sign out
            </button>
          </>
        ) : (
          <Link className="board-login-link" to="/login">Sign in</Link>
        )}
      </div>
    </header>
  );
}
