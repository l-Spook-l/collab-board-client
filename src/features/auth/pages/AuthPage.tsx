import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

import { loginWithAuth0 } from "../api/auth";
import PasswordAuthDialog from "../components/PasswordAuthDialog";
import { useAuthSession } from "../model/AuthSession";
import BoardPage from "../../boards/pages/BoardPage";

function AuthPage() {
  const {
    loginWithRedirect,
    getAccessTokenSilently,
    isAuthenticated,
    isLoading,
    error,
  } = useAuth0();
  const navigate = useNavigate();
  const { accessToken, setAccessToken } = useAuthSession();
  const [backendError, setBackendError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const auth0ExchangeStarted = useRef(false);

  const handlePasswordAuthenticated = (token: string) => {
    setAccessToken(token);
    navigate("/", { replace: true });
  };

  const handleLogin = async () => {
    setBackendError("");
    await loginWithRedirect({
      authorizationParams: {
        connection: "google-oauth2",
      },
      // Auth0 returns the user to this same dialog to exchange the token for a backend JWT.
      appState: {
        returnTo: "/login",
      },
    });
  };

  const handleConnectBackend = useCallback(async () => {
    setIsConnecting(true);
    setBackendError("");

    try {
      const auth0Token = await getAccessTokenSilently();
      if (!auth0Token) {
        throw new Error("Auth0 access token is missing");
      }

      const result = await loginWithAuth0(auth0Token);
      if (result.access_token) {
        setAccessToken(result.access_token);
      } else {
        setBackendError("FastAPI did not return an access token.");
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        setBackendError(typeof detail === "string" ? detail : err.message);
      } else if (err instanceof Error) {
        setBackendError(err.message);
      } else {
        setBackendError("Unknown authentication error");
      }
    } finally {
      setIsConnecting(false);
    }
  }, [getAccessTokenSilently, setAccessToken]);

  useEffect(() => {
    // An existing backend session takes the user straight back to the canvas.
    if (accessToken) {
      navigate("/", { replace: true });
      return;
    }

    // After Google sign-in, automatically obtain a JWT from our backend.
    if (
      isLoading ||
      !isAuthenticated ||
      auth0ExchangeStarted.current
    ) {
      return;
    }

    auth0ExchangeStarted.current = true;
    void handleConnectBackend();
  }, [
    accessToken,
    handleConnectBackend,
    isAuthenticated,
    isLoading,
    navigate,
  ]);

  const handleGoogleLogin = () => {
    // If the user is already signed in to Auth0, this button retries the exchange with FastAPI.
    if (isAuthenticated) {
      void handleConnectBackend();
      return;
    }

    void handleLogin();
  };

  const googleButtonLabel = isLoading
    ? "Checking sign-in..."
    : isConnecting
      ? "Finishing sign-in..."
      : isAuthenticated
        ? "Retry connection"
        : "Continue with Google";

  // Keep the form hidden while Auth0 loads or exchanges the token for a FastAPI JWT.
  // If the exchange fails, show the form again with an error message and a retry button.
  const isFinishingLogin =
    isLoading ||
    isConnecting ||
    Boolean(accessToken) ||
    (isAuthenticated && !backendError);

  return (
    <>
      {/* The canvas remains in the background; the separate sign-in selection page is no longer shown. */}
      <BoardPage />

      {!isFinishingLogin && (
        <PasswordAuthDialog
          onClose={() => navigate("/", { replace: true })}
          onAuthenticated={handlePasswordAuthenticated}
          onGoogleLogin={handleGoogleLogin}
          googleError={backendError || error?.message || ""}
          googleButtonLabel={googleButtonLabel}
          isGoogleConnecting={isLoading || isConnecting}
        />
      )}
    </>
  );
}

export default AuthPage;
