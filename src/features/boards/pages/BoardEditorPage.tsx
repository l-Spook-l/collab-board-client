import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";

import { useAuthSession } from "../../auth/model/AuthSession";
import BoardHeader from "../components/BoardHeader";
import { getBoard, inviteToBoard, searchUserByEmail } from "../api/boards";
import type { BoardDetails, BoardMember } from "../model/document";
import type { BoardRealtimeEvent, BoardSocketState } from "../realtime/events";
import { useBoardSocket } from "../realtime/useBoardSocket";
import Whiteboard, { type WhiteboardHandle } from "../editor/canvas/Whiteboard";
import "./BoardEditorPage.css";

function BoardEditorPage() {
  const { boardId: rawBoardId } = useParams();
  const boardId = Number(rawBoardId);
  const validBoardId = Number.isInteger(boardId) && boardId > 0 ? boardId : null;
  const { accessToken } = useAuthSession();
  const navigate = useNavigate();
  const whiteboardRef = useRef<WhiteboardHandle>(null);
  const [board, setBoard] = useState<BoardDetails | null>(null);
  const [loadedBoardId, setLoadedBoardId] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [foundUser, setFoundUser] = useState<BoardMember | null>(null);
  const [inviteMessage, setInviteMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const isLoading = validBoardId !== null && loadedBoardId !== validBoardId;
  const visibleBoard = board?.id === validBoardId ? board : null;
  const visibleError = validBoardId === null
    ? "Invalid board URL."
    : loadedBoardId === validBoardId ? error : "";

  useEffect(() => {
    if (!accessToken) {
      navigate("/login", { replace: true });
      return;
    }
    if (validBoardId === null) {
      return;
    }

    let active = true;
    void getBoard(accessToken, validBoardId)
      .then((value) => {
        if (!active) return;
        setBoard(value);
        setError("");
        setLoadedBoardId(validBoardId);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (axios.isAxiosError(reason) && reason.response?.status === 401) {
          setError("Session expired. Please sign in again.");
        } else {
          setError("Board not found or you do not have access.");
        }
        setLoadedBoardId(validBoardId);
      });
    return () => {
      active = false;
    };
  }, [accessToken, navigate, validBoardId]);

  const handleSocketState = useCallback((state: BoardSocketState) => {
    whiteboardRef.current?.loadDocument(state.document);
    setBoard((current) => current ? {
      ...current,
      title: state.board.title,
      revision: state.board.revision,
      document: state.document,
    } : current);
    setIsDirty(state.dirty);
  }, []);

  const handleSocketEvent = useCallback((event: BoardRealtimeEvent) => {
    whiteboardRef.current?.applyRemoteEvent(event);
  }, []);

  const handleSocketSaved = useCallback((savedRevision: number) => {
    setBoard((current) => current ? { ...current, revision: savedRevision } : current);
    setIsDirty(false);
  }, []);

  const handleBoardDeleted = useCallback(() => {
    navigate("/boards", { replace: true });
  }, [navigate]);

  const socketBoardId = visibleBoard ? validBoardId : null;
  const { emitEvent, presence, revision, saveBoard, status } = useBoardSocket(
    accessToken,
    socketBoardId,
    {
      onState: handleSocketState,
      onEvent: handleSocketEvent,
      onSaved: handleSocketSaved,
      onDeleted: handleBoardDeleted,
    },
  );

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [isDirty]);

  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const savedRevision = await saveBoard();
      setBoard((current) => current ? { ...current, revision: savedRevision } : current);
    setIsDirty(false);
      setMessage("Board saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the board.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !email.trim()) return;
    setIsSearching(true);
    setFoundUser(null);
    setInviteMessage("");
    try {
      const user = await searchUserByEmail(accessToken, email.trim());
      setFoundUser(user);
    } catch {
      setInviteMessage("No registered user was found with this email.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleInvite = async () => {
    if (!accessToken || !board || !foundUser || isInviting) return;
    setIsInviting(true);
    setInviteMessage("");
    try {
      const member = await inviteToBoard(accessToken, board.id, foundUser.email);
      setBoard((current) => current ? {
        ...current,
        members: current.members.some((item) => item.id === member.id)
          ? current.members
          : [...current.members, member],
      } : current);
      setInviteMessage(`${member.name || member.email} now has access to the board.`);
      setFoundUser(null);
      setEmail("");
    } catch (reason) {
      if (axios.isAxiosError(reason) && reason.response?.status === 404) {
        setInviteMessage("User or board not found.");
      } else if (
        axios.isAxiosError(reason) &&
        typeof reason.response?.data?.detail === "string"
      ) {
        setInviteMessage(reason.response.data.detail);
      } else {
        setInviteMessage("Could not add the user to the board.");
      }
    } finally {
      setIsInviting(false);
    }
  };

  const markDirty = useCallback(() => setIsDirty(true), []);

  return (
    <main className="board-editor-page">
      <BoardHeader
      title={visibleBoard?.title || "Board"}
        subtitle={status === "connected" ? "Collaborative drawing · connected" : "Collaborative drawing · disconnected"}
      >
        <Link className="board-profile-link" to="/boards">My boards</Link>
        <button
          className="board-login-link"
          type="button"
          disabled={!isDirty || isSaving || status !== "connected"}
          onClick={() => void handleSave()}
        >
          {isSaving ? "Saving..." : isDirty ? "Save" : "Saved"}
        </button>
      </BoardHeader>

      {isLoading && <p className="board-editor-message">Loading board…</p>}
      {visibleError && <p className="board-page-error" role="alert">{visibleError}</p>}
      {message && <p className="board-editor-success" role="status">{message}</p>}

      {visibleBoard && !isLoading && (
        <>
          <div className="board-collaboration-bar">
            <div className="board-online-users" aria-live="polite">
              <strong>On this board:</strong>
              {presence.length === 0 ? (
                <span>connecting participants…</span>
              ) : presence.map((user) => (
                <span className="board-user-chip" key={user.id} title={user.email}>
                  {user.name || user.email}
                </span>
              ))}
            </div>

            {visibleBoard.role === "owner" && (
              <form className="board-invite-form" onSubmit={(event) => void handleSearch(event)}>
                <label htmlFor="board-invite-email">Invite by email</label>
                <input
                  id="board-invite-email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setFoundUser(null);
                    setInviteMessage("");
                  }}
                  placeholder="user@example.com"
                  required
                />
                {!foundUser ? (
                  <button type="submit" disabled={isSearching}>
                    {isSearching ? "Searching…" : "Search"}
                  </button>
                ) : (
                  <button type="button" disabled={isInviting} onClick={() => void handleInvite()}>
                    {isInviting ? "Adding…" : "Grant access"}
                  </button>
                )}
                {foundUser && <span className="board-invite-found">{foundUser.name || foundUser.email}</span>}
                {inviteMessage && <span className="board-invite-message" role="status">{inviteMessage}</span>}
              </form>
            )}
          </div>

          {isDirty && (
            <p className="board-unsaved-message" role="status">
              There are unsaved changes{revision ? ` · saved revision ${revision}` : ""}.
            </p>
          )}
          <Whiteboard
            ref={whiteboardRef}
            initialDocument={visibleBoard.document}
            disabled={status !== "connected"}
            onRealtimeEvent={emitEvent}
            onDocumentChange={markDirty}
          />
        </>
      )}
    </main>
  );
}

export default BoardEditorPage;
