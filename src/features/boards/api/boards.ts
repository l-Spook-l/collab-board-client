import { http } from "../../../shared/api/http";
import type {
  BoardDetails,
  BoardDeleteResponse,
  BoardDocument,
  BoardListItem,
  BoardMember,
} from "../model/document";

function authConfig(accessToken: string) {
  return { headers: { Authorization: `Bearer ${accessToken}` } };
}

export async function createBoard(
  accessToken: string,
  title: string,
  document: BoardDocument,
): Promise<BoardDetails> {
  const response = await http.post<BoardDetails>(
    "/boards/",
    { title, document },
    authConfig(accessToken),
  );
  return response.data;
}

export async function getBoards(accessToken: string): Promise<BoardListItem[]> {
  const response = await http.get<{ boards: BoardListItem[] }>(
    "/boards/",
    authConfig(accessToken),
  );
  return response.data.boards;
}

export async function getBoard(
  accessToken: string,
  boardId: number,
): Promise<BoardDetails> {
  const response = await http.get<BoardDetails>(
    `/boards/${boardId}`,
    authConfig(accessToken),
  );
  return response.data;
}

export async function deleteBoard(
  accessToken: string,
  boardId: number,
): Promise<BoardDeleteResponse> {
  const response = await http.delete<BoardDeleteResponse>(
    `/boards/${boardId}`,
    authConfig(accessToken),
  );
  return response.data;
}

export async function leaveBoard(
  accessToken: string,
  boardId: number,
): Promise<void> {
  await http.delete(`/boards/${boardId}/members/me`, authConfig(accessToken));
}

export async function searchUserByEmail(
  accessToken: string,
  email: string,
): Promise<BoardMember> {
  const response = await http.get<BoardMember>("/users/search", {
    ...authConfig(accessToken),
    params: { email },
  });
  return { ...response.data, role: "editor" };
}

export async function inviteToBoard(
  accessToken: string,
  boardId: number,
  email: string,
): Promise<BoardMember> {
  const response = await http.post<BoardMember>(
    `/boards/${boardId}/members`,
    { email },
    authConfig(accessToken),
  );
  return { ...response.data, role: "editor" };
}
