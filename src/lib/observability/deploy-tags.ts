/**
 * Deploy-identity tags attached to every Sentry event.
 *
 * EDGE SAFETY: reads process.env and nothing else — no node builtins, no
 * next/headers — so it is safe to import from sentry.edge.config.ts. Keep it
 * that way; see src/test/guards/middleware-edge-safety.test.ts for the class
 * of regression this avoids.
 *
 * VERCEL_DEPLOYMENT_ID is exposed by Vercel on every runtime (it looks like
 * `dpl_XXXX`) and is the value that maps an event back to one immutable
 * deployment. VERCEL_GIT_COMMIT_SHA and VERCEL_ENV round out "which code, which
 * environment" so a Sentry issue can be traced to a commit without guessing.
 */

export type DeployTags = {
  deploy_id: string
  commit_sha: string
  vercel_env: string
}

export function deployTags(): DeployTags {
  return {
    deploy_id: process.env.VERCEL_DEPLOYMENT_ID ?? 'local',
    commit_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
    vercel_env: process.env.VERCEL_ENV ?? 'development',
  }
}
