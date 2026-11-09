import { apiKey } from "@better-auth/api-key"
import { zenstackAdapter } from "@zenstackhq/better-auth"
import { betterAuth } from "better-auth"
import { openAPI } from "better-auth/plugins"

import { db } from "./db"

const APP_NAME = process.env.APP_NAME || "app"

// APP_NAME may be a display name, but spaces and the like are invalid in cookie names
const COOKIE_PREFIX =
  APP_NAME.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "app"

export const SESSION_COOKIE = `${COOKIE_PREFIX}.token`

export const auth = betterAuth({
  appName: APP_NAME,
  basePath: "/api/auth",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: zenstackAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  advanced: {
    cookiePrefix: COOKIE_PREFIX,
    cookies: { session_token: { name: SESSION_COOKIE } },
  },
  plugins: [
    openAPI({ disableDefaultReference: true }),
    apiKey({ enableSessionForAPIKeys: true }),
  ],
})
