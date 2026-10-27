export const BOARD_WIDTH = 1600;
export const BOARD_HEIGHT = 950;

export interface BoardPoint {
  x: number;
  y: number;
}

export interface BoardStroke {
  id: string;
  color: string;
  width: number;
  points: BoardPoint[];
  user_id?: number | null;
  is_eraser?: boolean | null;
}

export interface BoardDocument {
  version: 1;
  width: typeof BOARD_WIDTH;
  height: typeof BOARD_HEIGHT;
  strokes: BoardStroke[];
}

export interface BoardMember {
  id: number;
  email: string;
  name: string | null;
  role: "owner" | "editor";
}

export interface BoardDetails {
  id: number;
  title: string;
  owner_id: number;
  owner_name: string | null;
  role: "owner" | "editor";
  revision: number;
  document: BoardDocument;
  members: BoardMember[];
  created_at: string;
  updated_at: string;
}

export interface BoardListItem {
  id: number;
  title: string;
  owner_id: number;
  owner_name: string | null;
  revision: number;
  role: "owner" | "editor";
  updated_at: string;
}

export interface BoardDeleteResponse {
  id: number;
  title: string;
}

export function createEmptyBoardDocument(): BoardDocument {
  return { version: 1, width: BOARD_WIDTH, height: BOARD_HEIGHT, strokes: [] };
}
