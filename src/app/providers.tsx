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
        // Возвращаем пользователя в окно входа: там AuthPage обменяет токен Auth0 на JWT FastAPI.
        const returnTo = appState?.returnTo ?? "/login";
        window.history.replaceState({}, document.title, returnTo);

        // replaceState сам по себе не сообщает BrowserRouter о смене маршрута.
        window.dispatchEvent(new PopStateEvent("popstate"));
      }}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience,
        scope: "openid profile email",
      }}
    >
      {/* Auth0 отвечает за Google-вход, контекст — за JWT нашего backend. */}
      <AuthSessionProvider>{children}</AuthSessionProvider>
    </Auth0Provider>
  );
}
