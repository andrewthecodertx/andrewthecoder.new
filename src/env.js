// env.js — shared environment-mode helpers.
//
// Env files are loaded by Bun automatically:
//   .env              always (base)
//   .env.development  when NODE_ENV != "production"
//   .env.production   when NODE_ENV == "production"
// Real process env wins over file values.
export const IS_DEV = process.env.NODE_ENV !== "production";