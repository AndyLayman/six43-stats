// Version / build identity for diagnosing which deploy is running.
// NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA is set automatically by Vercel.
// For local dev it falls back to "dev".
const sha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
export const BUILD_SHA = sha ? sha.slice(0, 7) : "dev";
export const BUILD_BRANCH =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF ?? "local";
