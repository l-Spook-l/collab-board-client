import type { PropsWithChildren } from "react";
import { Auth0Provider } from "@auth0/auth0-react";
import { AuthSessionProvider } from "../features/auth/model/AuthSession";

export function AppProviders({ children }: PropsWithChildren) {
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      onRedirectCallback={(appState) => {
        // Return the user to the sign-in dialog, where AuthPage exchanges the Auth0 token for a FastAPI JWT.
        const returnTo = appState?.returnTo ?? "/login";
        window.history.replaceState({}, document.title, returnTo);

        // replaceState alone does not notify BrowserRouter that the route has changed.
        window.dispatchEvent(new PopStateEvent("popstate"));
      }}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience,
        scope: "openid profile email",
      }}
    >
      {/* Auth0 handles Google sign-in; the context stores our backend JWT. */}
      <AuthSessionProvider>{children}</AuthSessionProvider>
    </Auth0Provider>
  );
}
