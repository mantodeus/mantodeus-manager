import type { User } from "../../drizzle/schema";

const now = new Date("2024-01-05T12:00:00Z");

export const UI_DEV_USER_ID = 1;

export const UI_DEV_USER: User = {
  id: UI_DEV_USER_ID,
  supabaseId: "ui-dev-user",
  name: "UI Dev",
  email: "ui.dev@example.com",
  loginMethod: "password",
  role: "admin",
  createdAt: now,
  updatedAt: now,
  lastSignedIn: now,
};
