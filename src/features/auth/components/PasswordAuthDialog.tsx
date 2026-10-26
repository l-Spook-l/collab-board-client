import { useState, type FormEvent, type MouseEvent } from "react";
import axios from "axios";

import {
    loginWithPassword,
    registerWithPassword,
} from "../api/auth";
import type { PasswordRegistrationData } from "../model/auth";
import "./PasswordAuthDialog.css";

interface PasswordAuthDialogProps {
    onClose: () => void;
    onAuthenticated: (accessToken: string) => void;
    onGoogleLogin: () => void;
    googleError: string;
    googleButtonLabel: string;
    isGoogleConnecting: boolean;
}

type AuthMode = "login" | "register";

function getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as { detail?: unknown } | undefined;
        const detail = data?.detail;

        if (typeof detail === "string") {
            return detail;
        }

        // FastAPI may return a list of validation errors instead of a single string.
        if (Array.isArray(detail)) {
            const messages = detail
                .map((item) => {
                    if (typeof item === "object" && item !== null && "msg" in item) {
                        return String(item.msg);
                    }

                    return String(item);
                })
                .filter(Boolean);

            if (messages.length > 0) {
                return messages.join(", ");
            }
        }

        return error.message;
    }

    return error instanceof Error ? error.message : "Unexpected authentication error";
}

function PasswordAuthDialog({
    onClose,
    onAuthenticated,
    onGoogleLogin,
    googleError,
    googleButtonLabel,
    isGoogleConnecting,
}: PasswordAuthDialogProps) {
    const [mode, setMode] = useState<AuthMode>("login");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
        // Close the dialog when the dimmed backdrop is clicked, but not while a request is active.
        if (event.target === event.currentTarget && !isSubmitting) {
            onClose();
        }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setErrorMessage("");
        setIsSubmitting(true);

        try {
            if (mode === "register") {
                const registrationData: PasswordRegistrationData = {
                    name,
                    email,
                    password,
                };

                await registerWithPassword(registrationData);
            }

            // After registration and password sign-in, obtain the JWT the same way.
            const result = await loginWithPassword({ email, password });
            onAuthenticated(result.access_token);
        } catch (error: unknown) {
            setErrorMessage(getErrorMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    };

    const switchMode = () => {
        setErrorMessage("");
        setMode((currentMode) =>
            currentMode === "login" ? "register" : "login",
        );
    };

    const isRegistering = mode === "register";

    return (
        <div
            className="password-dialog-backdrop"
            role="presentation"
            onMouseDown={closeFromBackdrop}
        >
            <section
                className="password-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="password-dialog-title"
            >
                <aside className="password-dialog-brand" aria-label="CollabBoard">
                    <div className="password-dialog-brand-lockup">
                        <span className="password-dialog-brand-mark" aria-hidden="true">
                            <span />
                            <span />
                        </span>
                        <span className="password-dialog-brand-name">CollabBoard</span>
                    </div>

                    <p className="password-dialog-tagline">
                        Work together<br />on one canvas
                    </p>

                    {/* Decorative canvas sketch for the sidebar. */}
                    <div className="password-dialog-brand-art" aria-hidden="true">
                        <div className="password-dialog-art-connector" />
                        <div className="password-dialog-art-card password-dialog-art-card-main">
                            <span />
                            <span />
                            <span />
                        </div>
                        <div className="password-dialog-art-card password-dialog-art-card-note">
                            <span />
                            <span />
                        </div>
                        <span className="password-dialog-art-avatar password-dialog-art-avatar-one" />
                        <span className="password-dialog-art-avatar password-dialog-art-avatar-two" />
                    </div>
                </aside>

                <div className="password-dialog-content">
                    <button
                        className="password-dialog-close"
                        type="button"
                        aria-label="Close dialog"
                        disabled={isSubmitting}
                        onClick={onClose}
                    >
                        ×
                    </button>

                    <h2 id="password-dialog-title">
                        {isRegistering ? "Create account" : "Sign in to CollabBoard"}
                    </h2>

                    <form onSubmit={handleSubmit}>
                        {isRegistering && (
                            <label className="password-dialog-field">
                                Name
                                <input
                                    type="text"
                                    autoComplete="name"
                                    minLength={3}
                                    maxLength={50}
                                    required
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                />
                            </label>
                        )}

                        <label className="password-dialog-field">
                            Email
                            <input
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                            />
                        </label>

                        <div className="password-dialog-field">
                            <label htmlFor="password-input">Password</label>

                            <div className="password-dialog-password-row">
                                <input
                                    id="password-input"
                                    type={isPasswordVisible ? "text" : "password"}
                                    autoComplete={isRegistering ? "new-password" : "current-password"}
                                    minLength={isRegistering ? 6 : undefined}
                                    required
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                />

                                <button
                                    className="password-dialog-visibility"
                                    type="button"
                                    aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                                    aria-pressed={isPasswordVisible}
                                    title={isPasswordVisible ? "Hide password" : "Show password"}
                                    onClick={() => setIsPasswordVisible((visible) => !visible)}
                                >
                                    <svg
                                        aria-hidden="true"
                                        viewBox="0 0 24 24"
                                        width="20"
                                        height="20"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        {isPasswordVisible ? (
                                            <>
                                                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </>
                                        ) : (
                                            <>
                                                <path d="M3 3l18 18" />
                                                <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                                                <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a13.8 13.8 0 0 1-4.2 4.9" />
                                                <path d="M6.2 6.2A14.2 14.2 0 0 0 2 12s3.6 7 10 7a10.8 10.8 0 0 0 4-.8" />
                                            </>
                                        )}
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {errorMessage && (
                            <p className="password-dialog-error" role="alert">
                                {errorMessage}
                            </p>
                        )}

                        <button
                            className="password-dialog-submit"
                            type="submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting
                                ? "Please wait..."
                                : isRegistering
                                    ? "Create account"
                                    : "Sign in"}
                        </button>
                    </form>

                    <div className="password-dialog-divider">
                        <span>or</span>
                    </div>

                    {googleError && (
                        <p className="password-dialog-error" role="alert">
                            {googleError}
                        </p>
                    )}

                    <button
                        className="password-dialog-google"
                        type="button"
                        disabled={isGoogleConnecting || isSubmitting}
                        onClick={onGoogleLogin}
                    >
                        <span className="password-dialog-google-mark" aria-hidden="true">G</span>
                        {googleButtonLabel}
                    </button>

                    <button
                        className="password-dialog-switch"
                        type="button"
                        disabled={isSubmitting}
                        onClick={switchMode}
                    >
                        {isRegistering
                            ? "Already have an account? Sign in"
                            : "Don't have an account? Sign up"}
                    </button>
                </div>
            </section>
        </div>
    );
}

export default PasswordAuthDialog;
