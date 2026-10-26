import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

import { useAuthSession } from "../../auth/model/AuthSession";
import BoardHeader from "../components/BoardHeader";
import { deleteBoard, getBoards } from "../api/boards";
import type { BoardListItem } from "../model/document";
import "./BoardListPage.css";

function BoardListPage() {
  const { accessToken } = useAuthSession();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<BoardListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [message, setMessage] = useState("");
  const [deletingBoardId, setDeletingBoardId] = useState<number | null>(null);

  useEffect(() => {
    if (!accessToken) {
      navigate("/login", { replace: true });
      return;
    }
    let active = true;
    void getBoards(accessToken)
      .then((items) => {
        if (active) setBoards(items);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (axios.isAxiosError(reason) && reason.response?.status === 401) {
          setError("Session expired. Please sign in again.");
        } else {
          setError("Could not load boards.");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, navigate]);

  const handleDelete = async (board: BoardListItem) => {
    if (!accessToken || deletingBoardId !== null) return;
    if (!window.confirm(`Delete "${board.title}"? This cannot be undone.`)) return;

    setDeletingBoardId(board.id);
    setDeleteError("");
    setMessage("");
    try {
      const deletedBoard = await deleteBoard(accessToken, board.id);
      setBoards((current) => current.filter((item) => item.id !== deletedBoard.id));
      setMessage(`Deleted "${deletedBoard.title}".`);
    } catch (reason) {
      if (axios.isAxiosError(reason) && reason.response?.status === 403) {
        setDeleteError("Only the board owner can delete it.");
      } else if (axios.isAxiosError(reason) && reason.response?.status === 404) {
        setDeleteError("Board not found.");
      } else {
        setDeleteError("Could not delete the board.");
      }
    } finally {
      setDeletingBoardId(null);
    }
  };

  return (
    <main className="board-list-page">
      <BoardHeader title="My boards" subtitle="Saved boards and boards shared with you">
        <Link className="board-action-link" to="/">Create board</Link>
      </BoardHeader>
      <section className="board-list-content">
        {isLoading && <p>Loading boards…</p>}
        {error && <p className="board-page-error" role="alert">{error}</p>}
        {deleteError && <p className="board-page-error" role="alert">{deleteError}</p>}
        {message && <p className="board-editor-success" role="status">{message}</p>}
        {!isLoading && !error && boards.length === 0 && (
          <div className="board-list-empty">
            <h2>No saved boards yet</h2>
            <p>Draw something on the canvas and click “Save.”</p>
            <Link className="board-action-link" to="/">Open canvas</Link>
          </div>
        )}
        <div className="board-list-grid">
          {boards.map((board) => (
            <article className="board-card" key={board.id}>
              <Link className="board-card-link" to={`/boards/${board.id}`}>
                <strong>{board.title}</strong>
                <span>{board.role === "owner" ? "Owner" : `By: ${board.owner_name || "user"}`}</span>
                <small>Save #{board.revision}</small>
              </Link>
              {board.role === "owner" && (
                <button
                  className="board-delete-button"
                  type="button"
                  disabled={deletingBoardId !== null}
                  onClick={() => void handleDelete(board)}
                >
                  {deletingBoardId === board.id ? "Deleting…" : "Delete"}
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default BoardListPage;
