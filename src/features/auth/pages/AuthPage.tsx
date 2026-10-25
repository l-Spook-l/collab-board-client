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
      // Auth0 возвращает пользователя в эту же модалку для обмена backend-токена.
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
    // Уже сохранённая backend-сессия сразу возвращает пользователя на холст.
    if (accessToken) {
      navigate("/", { replace: true });
      return;
    }

    // После Google-входа автоматически получаем JWT нашего backend.
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
    // Если Auth0 уже вошёл, эта же кнопка позволяет повторить обмен с FastAPI.
    if (isAuthenticated) {
      void handleConnectBackend();
      return;
    }

    void handleLogin();
  };

  const googleButtonLabel = isLoading
    ? "Проверка входа..."
    : isConnecting
      ? "Завершаем вход..."
      : isAuthenticated
        ? "Повторить подключение"
        : "Продолжить с Google";

  // Не показываем форму, пока Auth0 загружается или обменивает токен на JWT FastAPI.
  // Если обмен завершится ошибкой, форма снова появится с сообщением и кнопкой повтора.
  const isFinishingLogin =
    isLoading ||
    isConnecting ||
    Boolean(accessToken) ||
    (isAuthenticated && !backendError);

  return (
    <>
      {/* Холст остаётся фоном; отдельная страница выбора входа больше не показывается. */}
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
