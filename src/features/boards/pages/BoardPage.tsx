import { useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

import { useAuthSession } from "../../auth/model/AuthSession";
import BoardHeader from "../components/BoardHeader";
import Whiteboard, { type WhiteboardHandle } from "../editor/canvas/Whiteboard";
import { createBoard } from "../api/boards";
import "./BoardPage.css";

function BoardPage() {
    const { accessToken } = useAuthSession();
    const navigate = useNavigate();
    const whiteboardRef = useRef<WhiteboardHandle>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    const saveCurrentDrawing = async () => {
        if (!accessToken || !whiteboardRef.current || isSaving) return;
        const title = window.prompt("Board title", "New board")?.trim();
        if (!title) return;

        setError("");
        setIsSaving(true);
        try {
            const board = await createBoard(
                accessToken,
                title,
                whiteboardRef.current.getDocument(),
            );
            navigate(`/boards/${board.id}`);
        } catch (reason) {
            const detail = axios.isAxiosError(reason) ? reason.response?.data?.detail : null;
            setError(
                typeof detail === "string"
                    ? detail
                    : "Could not create the board. Check your connection and sign in again.",
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <main className="board-page">
            <BoardHeader title="CollabBoard" subtitle="Free canvas">
                {accessToken && (
                    <>
                        <Link className="board-profile-link" to="/boards">My boards</Link>
                        <button
                            className="board-login-link"
                            type="button"
                            disabled={isSaving}
                            onClick={() => void saveCurrentDrawing()}
                        >
                            {isSaving ? "Saving..." : "Save"}
                        </button>
                    </>
                )}
            </BoardHeader>

            {error && <p className="board-page-error" role="alert">{error}</p>}

            <Whiteboard ref={whiteboardRef} />
        </main>
    );
}

export default BoardPage;
