/* The deploy, as the Amplify build wrote it into build-info.js (loaded before this module). */
import type { BuildInfo } from "./types.ts";

export const build: BuildInfo = window.BUILD_INFO ?? { deployed: false };

/** The re-check API's address (VERIFY_URL in Amplify). Without it, no re-check button. */
export const recheckUrl = typeof build.verifyUrl === "string" && /^https?:\/\//.test(build.verifyUrl) ? build.verifyUrl : "";

/** The commit this page was built from, or "" for a local copy. */
export const deployCommit = build.deployed ? build.commit ?? "" : "";
