import { http } from "../../../shared/api/http";
import type { BackendTokenResponse, PasswordLoginData, PasswordRegistrationData, RegisteredUser } from "../model/auth";

// Sends the Auth0 token to FastAPI, which verifies it and finds or creates the user.
export async function loginWithAuth0(
  auth0AccessToken: string,
): Promise<BackendTokenResponse> {
  const response = await http.post<BackendTokenResponse>("/auth/login/auth0", {
    token: auth0AccessToken,
  });

  return response.data;
}

// Обычный вход: FastAPI принимает email и пароль и возвращает JWT.
export async function loginWithPassword(
  data: PasswordLoginData,
): Promise<BackendTokenResponse> {
  const response = await http.post<BackendTokenResponse>("/auth/login", data);
  return response.data;
}

// Регистрация создаёт пользователя, но не выдаёт JWT.
export async function registerWithPassword(
  data: PasswordRegistrationData,
): Promise<RegisteredUser> {
  const response = await http.post<RegisteredUser>("/auth/register", data);
  return response.data;
}