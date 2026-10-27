import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

import { useAuthSession } from "../../auth/model/AuthSession";
import BoardHeader from "../components/BoardHeader";
import { deleteBoard, getBoards, leaveBoard } from "../api/boards";
import type { BoardListItem } from "../model/document";
import "./BoardListPage.css";

function BoardListPage() {
  const { accessToken } = useAuthSession();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<BoardListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [busyBoardId, setBusyBoardId] = useState<number | null>(null);

  const ownedBoards = boards.filter((board) => board.role === "owner");
  const sharedBoards = boards.filter((board) => board.role !== "owner");

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
    if (!accessToken || busyBoardId !== null) return;
    if (!window.confirm(`Delete "${board.title}"? This cannot be undone.`)) return;

    setBusyBoardId(board.id);
    setActionError("");
    setActionMessage("");
    try {
      const deletedBoard = await deleteBoard(accessToken, board.id);
      setBoards((current) => current.filter((item) => item.id !== deletedBoard.id));
      setActionMessage(`Deleted "${deletedBoard.title}".`);
    } catch (reason) {
      if (axios.isAxiosError(reason) && reason.response?.status === 403) {
        setActionError("Only the board owner can delete it.");
      } else if (axios.isAxiosError(reason) && reason.response?.status === 404) {
        setActionError("Board not found.");
      } else {
        setActionError("Could not delete the board.");
      }
    } finally {
      setBusyBoardId(null);
    }
  };

  const handleLeave = async (board: BoardListItem) => {
    if (!accessToken || busyBoardId !== null) return;
    const confirmed = window.confirm(
      `Leave "${board.title}"? You will lose access, but the board will remain available to its owner and other collaborators.`,
    );
    if (!confirmed) return;

    setBusyBoardId(board.id);
    setActionError("");
    setActionMessage("");
    try {
      await leaveBoard(accessToken, board.id);
      setBoards((current) => current.filter((item) => item.id !== board.id));
      setActionMessage(`You left "${board.title}".`);
    } catch (reason) {
      if (axios.isAxiosError(reason) && reason.response?.status === 403) {
        setActionError("Board owners cannot leave their own board.");
      } else if (axios.isAxiosError(reason) && reason.response?.status === 404) {
        setActionError("Board or invitation not found.");
      } else {
        setActionError("Could not leave the board.");
      }
    } finally {
      setBusyBoardId(null);
    }
  };

  const renderBoardCard = (board: BoardListItem) => (
    <article className="board-card" key={board.id}>
      <Link className="board-card-link" to={`/boards/${board.id}`}>
        <strong>{board.title}</strong>
        <span>{board.role === "owner" ? "Owner" : `By: ${board.owner_name || "user"}`}</span>
        <small>Save #{board.revision}</small>
      </Link>
      {board.role === "owner" ? (
        <button
          className="board-delete-button"
          type="button"
          disabled={busyBoardId !== null}
          onClick={() => void handleDelete(board)}
        >
          {busyBoardId === board.id ? "Deleting…" : "Delete board"}
        </button>
      ) : (
        <button
          className="board-leave-button"
          type="button"
          disabled={busyBoardId !== null}
          onClick={() => void handleLeave(board)}
        >
          {busyBoardId === board.id ? "Leaving…" : "Leave board"}
        </button>
      )}
    </article>
  );

  return (
    <main className="board-list-page">
      <BoardHeader title="Boards" subtitle="Your boards and boards shared with you">
        <Link className="board-action-link" to="/">Create board</Link>
      </BoardHeader>
      <section className="board-list-content">
        {isLoading && <p>Loading boards…</p>}
        {error && <p className="board-page-error" role="alert">{error}</p>}
        {actionError && <p className="board-page-error" role="alert">{actionError}</p>}
        {actionMessage && <p className="board-editor-success" role="status">{actionMessage}</p>}
        {!isLoading && !error && (
          <div className="board-list-groups">
            <section className="board-list-group" aria-labelledby="owned-boards-title">
              <h2 id="owned-boards-title">My boards</h2>
              {ownedBoards.length > 0 ? (
                <div className="board-list-grid">{ownedBoards.map(renderBoardCard)}</div>
              ) : (
                <div className="board-list-empty">
                  <p>You have not created any boards yet.</p>
                  <Link className="board-action-link" to="/">Create a board</Link>
                </div>
              )}
            </section>

            <section className="board-list-group" aria-labelledby="shared-boards-title">
              <h2 id="shared-boards-title">Shared with me</h2>
              {sharedBoards.length > 0 ? (
                <div className="board-list-grid">{sharedBoards.map(renderBoardCard)}</div>
              ) : (
                <p className="board-list-empty-message">
                  Boards you are invited to will appear here.
                </p>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

export default BoardListPage;
