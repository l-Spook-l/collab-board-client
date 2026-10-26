import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import type {
  BoardPresenceUser,
  BoardRealtimeEvent,
  BoardSocketState,
} from "./events";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface BoardSocketCallbacks {
  onState: (state: BoardSocketState) => void;
  onEvent: (event: BoardRealtimeEvent) => void;
  onSaved: (revision: number) => void;
  onDeleted: (board: { id: number; title: string }) => void;
}

export function useBoardSocket(
  accessToken: string | null,
  boardId: number | null,
  callbacks: BoardSocketCallbacks,
) {
  const socketRef = useRef<Socket | null>(null);
  const callbacksRef = useRef(callbacks);
  const [transport, setTransport] = useState<{
    boardId: number | null;
    status: ConnectionStatus;
  }>({ boardId: null, status: "disconnected" });
  const [presenceState, setPresenceState] = useState<{
    boardId: number | null;
    users: BoardPresenceUser[];
  }>({ boardId: null, users: [] });
  const [revision, setRevision] = useState<number | null>(null);
  const status = !accessToken || boardId === null
    ? "disconnected"
    : transport.boardId === boardId
      ? transport.status
      : "connecting";
  const presence = presenceState.boardId === boardId ? presenceState.users : [];

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    if (!accessToken || boardId === null) {
      return;
    }

    const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const socketOrigin = new URL(apiUrl, window.location.origin).origin;
    const socket = io(socketOrigin, {
      autoConnect: false,
      auth: { token: accessToken, board_id: boardId },
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => setTransport({ boardId, status: "connected" }));
    socket.on("disconnect", () => setTransport({ boardId, status: "disconnected" }));
    socket.on("connect_error", () => setTransport({ boardId, status: "error" }));
    socket.on("board:state", (state: BoardSocketState) => {
      setRevision(state.board.revision);
      setPresenceState({ boardId, users: state.presence });
      callbacksRef.current.onState(state);
    });
    socket.on("board:presence", (data: { users: BoardPresenceUser[] }) => {
      setPresenceState({ boardId, users: data.users });
    });
    socket.on("board:saved", (data: { revision: number }) => {
      setRevision(data.revision);
      callbacksRef.current.onSaved(data.revision);
    });
    socket.on("board:deleted", (board: { id: number; title: string }) => {
      callbacksRef.current.onDeleted(board);
    });
    socket.on("stroke:start", (data) =>
      callbacksRef.current.onEvent({ type: "stroke:start", data }),
    );
    socket.on("stroke:points", (data) =>
      callbacksRef.current.onEvent({ type: "stroke:points", data }),
    );
    socket.on("stroke:end", (data) =>
      callbacksRef.current.onEvent({ type: "stroke:end", data }),
    );
    socket.on("canvas:clear", () =>
      callbacksRef.current.onEvent({ type: "canvas:clear", data: {} }),
    );

    socket.connect();
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, boardId]);

  const emitEvent = useCallback((event: BoardRealtimeEvent) => {
    socketRef.current?.emit(event.type, event.data);
  }, []);

  const saveBoard = useCallback((): Promise<number> => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      return Promise.reject(new Error("Not connected to the board"));
    }

    return new Promise((resolve, reject) => {
      socket.timeout(10_000).emit(
        "board:save",
        {},
        (error: Error | null, response: { ok: boolean; revision?: number; error?: string }) => {
          if (error) {
            reject(new Error("The server did not confirm the save"));
          } else if (!response?.ok || response.revision === undefined) {
            reject(new Error(response?.error || "Could not save the board"));
          } else {
            setRevision(response.revision);
            resolve(response.revision);
          }
        },
      );
    });
  }, []);

  return {
    emitEvent,
    presence,
    revision,
    saveBoard,
    status,
  };
}

export type { ConnectionStatus };
