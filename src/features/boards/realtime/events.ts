import type { BoardPoint } from "../model/document";

export type BoardRealtimeEvent =
  | {
      type: "stroke:start";
      data: {
        stroke_id: string;
        color: string;
        width: number;
        point: BoardPoint;
      };
    }
  | {
      type: "stroke:points";
      data: { stroke_id: string; points: BoardPoint[] };
    }
  | { type: "stroke:end"; data: { stroke_id: string } }
  | { type: "canvas:clear"; data: Record<string, never> };

export interface BoardPresenceUser {
  id: number;
  name: string | null;
  email: string;
}

export interface BoardSocketState {
  board: {
    id: number;
    title: string;
    owner_id: number;
    revision: number;
  };
  document: import("../model/document").BoardDocument;
  presence: BoardPresenceUser[];
  dirty: boolean;
}
