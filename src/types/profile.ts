export type ProfileData = {
  id: string;
  username: string;
  firstName?: string;
  bio: string;
  profilePic: string | null;
  vibes_pro_portrait?: string | null;
  is_vibes_pro?: boolean;
  vibes_pro?: boolean;
  vibes_pro_until?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  interests: string[];
  email: string;
  language?: string;
  dateOfBirth?: string;
  gender?: string;
  hommies_count: number;
  snapshots_count: number;
  vibes_count: number;
};

export type DbProfile = Omit<ProfileData, "profilePic" | "dateOfBirth" | "gender"> & {
  profile_pic: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  vibes_pro?: boolean | null;
  vibes_pro_portrait?: string | null;
  vibes_pro_until?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  interests: string[] | null;
  language?: string | null;
  hommies_count?: number | null;
  snapshots_count?: number | null;
  vibes_count?: number | null;
};

export type ProfileSearchResult = {
  id: string;
  username: string;
  profilePic: string | null;
};
