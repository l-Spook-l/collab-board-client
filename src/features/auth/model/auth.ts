// JWT returned by the backend after successful sign-in.
export interface BackendTokenResponse {
  access_token: string;
  token_type?: string;
}

// Sign-in data must match the FastAPI schema.
export interface PasswordLoginData {
  email: string;
  password: string;
}

// The backend requires a name between 3 and 50 characters
// and a password of at least 6 characters.
export interface PasswordRegistrationData extends PasswordLoginData {
  name: string;
}

// The backend returns this object after registration.
// After registration, the frontend requests a JWT separately via /auth/login.
export interface RegisteredUser {
  id: number;
  email: string;
  name: string;
}
