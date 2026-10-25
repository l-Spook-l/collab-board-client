import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import { Link, Navigate } from "react-router-dom";

import { useAuthSession } from "../../auth/model/AuthSession";
import { getMyProfile, updateMyProfile } from "../api/profile";
import type { UserProfile } from "../model/profile";
import "./ProfilePage.css";

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    return typeof detail === "string" ? detail : error.message;
  }

  return error instanceof Error ? error.message : "Не удалось выполнить запрос.";
}

function ProfilePage() {
  const { accessToken } = useAuthSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let isCurrent = true;
    setIsLoading(true);

    void getMyProfile(accessToken)
      .then((user) => {
        if (isCurrent) {
          setProfile(user);
          setName(user.name);
        }
      })
      .catch((requestError: unknown) => {
        if (isCurrent) {
          setError(getErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [accessToken]);

  const handleNameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !profile) return;

    setError("");
    setFeedback("");
    setIsSavingName(true);

    try {
      const updatedProfile = await updateMyProfile(accessToken, profile.id, { name });
      setProfile(updatedProfile);
      setName(updatedProfile.name);
      setFeedback("Имя обновлено.");
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSavingName(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !profile) return;

    setError("");
    setFeedback("");
    setIsSavingPassword(true);

    try {
      await updateMyProfile(accessToken, profile.id, { password });
      setPassword("");
      setFeedback("Пароль обновлён.");
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return (
    <main className="profile-page">
      <header className="profile-header">
        <Link to="/" className="profile-back-link">
          ← На холст
        </Link>
        <h1>Профиль</h1>
        <span className="profile-header-spacer" aria-hidden="true" />
      </header>

      <section className="profile-card" aria-labelledby="profile-title">
        <div className="profile-card-heading">
          <h2 id="profile-title">Настройки аккаунта</h2>
          {profile && <p>{profile.email}</p>}
        </div>

        {isLoading ? (
          <p className="profile-message">Загружаем профиль…</p>
        ) : (
          <>
            {error && <p className="profile-message profile-error" role="alert">{error}</p>}
            {feedback && <p className="profile-message profile-success" role="status">{feedback}</p>}

            {profile && (
              <>
                <form className="profile-form" onSubmit={handleNameSubmit}>
                  <label className="profile-field">
                    <span>Имя</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      minLength={3}
                      maxLength={50}
                      required
                    />
                  </label>
                  <button type="submit" disabled={isSavingName || name === profile.name}>
                    {isSavingName ? "Сохраняем…" : "Сохранить имя"}
                  </button>
                </form>

                <form className="profile-form" onSubmit={handlePasswordSubmit}>
                  <label className="profile-field">
                    <span>Новый пароль</span>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      minLength={6}
                      autoComplete="new-password"
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={isSavingPassword || password.length < 6}
                  >
                    {isSavingPassword ? "Сохраняем…" : "Изменить пароль"}
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default ProfilePage;
