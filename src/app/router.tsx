import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AuthPage from "../features/auth/pages/AuthPage";
import BoardPage from "../features/boards/pages/BoardPage";
import ProfilePage from "../features/profile/pages/ProfilePage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Главная страница теперь сразу показывает холст. */}
        <Route path="/" element={<BoardPage />} />

        {/* Оставляем текущий экран входа доступным отдельно. */}
        <Route path="/login" element={<AuthPage />} />

        {/* Настройки профиля текущего пользователя. */}
        <Route path="/profile" element={<ProfilePage />} />

        {/* Неизвестные адреса возвращаем на главную. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
