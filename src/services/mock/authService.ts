export const authService = {
  login: async (email: string, password: string) => {
    return { user: { id: "mock-user", email } };
  },
  logout: async () => {
    return { success: true };
  },
  signUp: async (email: string, password: string) => {
    return { user: { id: "mock-user", email } };
  },
};
