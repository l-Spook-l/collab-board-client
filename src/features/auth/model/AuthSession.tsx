import {
    createContext,
    useContext,
    useState,
    type PropsWithChildren,
} from "react";

interface AuthSessionValue {
    accessToken: string | null;
    setAccessToken: (token: string | null) => void;
}

const TOKEN_STORAGE_KEY = "collabboard_access_token";
const AuthSessionContext = createContext<AuthSessionValue | null>(null);

export function AuthSessionProvider({ children }: PropsWithChildren) {
    // Restore the token when the app loads.
    const [accessToken, setAccessTokenState] = useState<string | null>(() =>
        window.localStorage.getItem(TOKEN_STORAGE_KEY),
    );

    const setAccessToken = (token: string | null) => {
        setAccessTokenState(token);

        // Passing null on sign-out removes the stored token.
        if (token) {
            window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
        } else {
            window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
    };

    return (
        <AuthSessionContext.Provider value={{ accessToken, setAccessToken }}>
            {children}
        </AuthSessionContext.Provider>
    );
}

export function useAuthSession() {
    const session = useContext(AuthSessionContext);

    if (!session) {
        throw new Error("useAuthSession must be used inside AuthSessionProvider");
    }

    return session;
}
