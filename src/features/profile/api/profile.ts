import { http } from "../../../shared/api/http";
import type {
  ProfileUpdate,
  UpdatedProfileResponse,
  UserProfile,
} from "../model/profile";

function authConfig(accessToken: string) {
  return {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

export async function getMyProfile(accessToken: string): Promise<UserProfile> {
  const response = await http.get<UserProfile>("/auth/me", authConfig(accessToken));
  return response.data;
}

export async function updateMyProfile(
  accessToken: string,
  userId: number,
  data: ProfileUpdate,
): Promise<UserProfile> {
  const response = await http.patch<UpdatedProfileResponse>(
    `/users/${userId}`,
    data,
    authConfig(accessToken),
  );

  return response.data.user;
}
