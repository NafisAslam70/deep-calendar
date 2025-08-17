// import type { Config } from "drizzle-kit";

// export default {
//   schema: "./lib/schema.ts",
//   out: "./drizzle",
//   dialect: "postgresql",
//   dbCredentials: {
//     url: process.env.DATABASE_URL!,
//   },
// } satisfies Config;

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // Explicitly load .env.local

console.log("DATABASE_URL:", process.env.DATABASE_URL); // Debug log

/** @type { import("drizzle-kit").Config } */
export default {
  schema: "./lib/schema.ts",
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  out: "./drizzle",
};