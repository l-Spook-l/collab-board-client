import { Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

import { useAuthSession } from "../../auth/model/AuthSession";
import Whiteboard from "../editor/canvas/Whiteboard";
import "./BoardPage.css";

function BoardPage() {
    const { accessToken, setAccessToken } = useAuthSession();
    const { isAuthenticated, logout } = useAuth0();

    const handleLogout = () => {
        // Удаляем backend-токен; кнопка сразу снова станет «Войти».
        setAccessToken(null);

        // Если вход был через Auth0, завершаем и его сессию.
        if (isAuthenticated) {
            void logout({
                logoutParams: {
                    returnTo: window.location.origin,
                },
            });
        }
    };

    return (
        <main className="board-page">
            <header className="board-header">
                <div>
                    <h1>CollabBoard</h1>
                    <p>Свободный холст</p>
                </div>

                {accessToken ? (
                    <div className="board-header-actions">
                        <Link className="board-profile-link" to="/profile">
                            Профиль
                        </Link>
                        <button
                            className="board-login-link"
                            type="button"
                            onClick={handleLogout}
                        >
                            Выйти
                        </button>
                    </div>
                ) : (
                    <Link className="board-login-link" to="/login">
                        Войти
                    </Link>
                )}
            </header>

            <Whiteboard />
        </main>
    );
}

export default BoardPage;
