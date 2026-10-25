export interface UserProfile {
  id: number;
  email: string;
  name: string;
}

export interface ProfileUpdate {
  name?: string;
  password?: string;
}

interface UpdatedProfileResponse {
  user: UserProfile;
}

export type { UpdatedProfileResponse };
