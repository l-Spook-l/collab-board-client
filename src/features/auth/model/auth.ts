// JWT, который backend возвращает после успешного входа.
export interface BackendTokenResponse {
  access_token: string;
  token_type?: string;
}

// Данные для входа должны совпадать со схемой FastAPI.
export interface PasswordLoginData {
  email: string;
  password: string;
}

// Backend требует имя длиной от 3 до 50 символов,
// пароль — не короче 6 символов.
export interface PasswordRegistrationData extends PasswordLoginData {
  name: string;
}

// Такой объект backend возвращает после регистрации.
// После регистрации фронтенд отдельно запросит JWT через /auth/login.
export interface RegisteredUser {
  id: number;
  email: string;
  name: string;
}