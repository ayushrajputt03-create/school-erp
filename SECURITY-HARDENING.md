# Security Boundaries and Rollout

## Architecture

- Supabase RLS is the authorization boundary. Frontend visibility is not authorization.
- app_users stores server-controlled school and role membership; requests never select their own role.
- Staff session data is queried using the caller's JWT, not an unrestricted service-role read.
- Staff password hashes remain server-only. The initial legacy DOB login requires a password change.
- Parent sessions use HttpOnly, SameSite cookies with server-side expiry and ownership checks.
- Password changes invalidate older parent sessions. Public password reset is disabled; school-assisted recovery is required.
- Authentication limits use atomic database counters, shared across serverless instances.
- Legacy print HTML is parsed inertly, stripped of executable content, given a restrictive CSP and detached from its opener.
- Privileged service credentials belong only in server environment variables, never VITE-prefixed variables.

## Verification

Run from the project root:

```powershell
node scripts/test-security.cjs
node scripts/test-print-security.mjs
node supabase/test-security-boundaries.mjs
node supabase/test-receptionist-rbac.mjs
npm run build
```

Database tests create temporary fixtures inside transactions and roll them back.
The security boundaries migration was applied to the configured Supabase database.
Realtime Database rules were published to school-open-erp. Firebase Storage is not
configured on that project, so storage rules could not be published there.

`node scripts/test-deployed-auth.mjs <protected-deployment-url>` exercises the
staff and parent APIs through the authenticated Vercel CLI. It creates a uniquely
named disposable school and removes only its own fixtures in a finally block.

## Remaining Release Gates

- Rotate previously exposed database passwords, service keys, Firebase signing material and deployment tokens at their providers. Editing source does not revoke these credentials.
- Deploy application changes before claiming the new cookie/password flows are live.
- Firebase Storage setup and its rule deployment remain separate from Supabase bucket restrictions.
- Exercise teacher, receptionist, parent and admin journeys with dedicated test accounts, including uploads and every print preview.
- Firebase fallback teacher class/section authorization needs dedicated emulator coverage before that backend is re-enabled.
- Review all existing RLS policies, storage access and security-definer RPCs periodically. Passing focused regression tests is not a complete penetration test.
- Avoid placing sensitive student records or privileged tokens in browser persistence or application logs.

No guarantee of being unhackable is implied by this hardening pass.
