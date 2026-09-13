export const userService = {
  fetchProfile: async () => ({ id: "mock-user", username: "mockuser" }),
  upsertProfile: async () => ({ success: true }),
  fetchProfileByUsername: async () => ({ id: "mock-user", username: "mockuser" }),
  uploadProfileImage: async () => ({ success: true }),
  searchUsersByUsername: async () => ([]),
};
