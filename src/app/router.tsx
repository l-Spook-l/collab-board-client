import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AuthPage from "../features/auth/pages/AuthPage";
import BoardPage from "../features/boards/pages/BoardPage";
import BoardListPage from "../features/boards/pages/BoardListPage";
import BoardEditorPage from "../features/boards/pages/BoardEditorPage";
import ProfilePage from "../features/profile/pages/ProfilePage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* The home page now opens directly to the canvas. */}
        <Route path="/" element={<BoardPage />} />
        <Route path="/boards" element={<BoardListPage />} />
        <Route path="/boards/:boardId" element={<BoardEditorPage />} />

        {/* Keep the current sign-in screen available separately. */}
        <Route path="/login" element={<AuthPage />} />

        {/* Current user's profile settings. */}
        <Route path="/profile" element={<ProfilePage />} />

        {/* Redirect unknown paths to the home page. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
