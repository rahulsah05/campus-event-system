# Campus Event MCP service

The MCP process is separate from Express, uses Streamable HTTP, and never connects to MongoDB directly. Event reads and writes call the current Express API, so event validation and persistence stay in the existing app. The project file tools are read only; no MCP tool runs arbitrary commands or writes repository files.

## Current repository state

- `frontend/` is the Vite/React Netlify site; `backend/` is the Express/Atlas API.
- The existing API exposes `/health` and `/api/events` CRUD plus `/api/events/stats/summary`. Its health response now reports Mongoose connection state.
- Git `origin` is `https://github.com/rahulsah05/campus-event-system`, branch `master`. Read access to that branch was verified. GitHub CLI is unavailable, so push/PR permissions were not verified.
- `.github/workflows/verify.yml` runs backend syntax checks, MCP tests, and the frontend production build. There was no backend test script.
- Netlify site ID/token, Netlify URL, existing Render service ID/token/URL, Atlas credentials, and an OAuth provider were not available here. Provider status tools report `not_configured` until the relevant secret and ID are set.

## MCP tools

| Tool | Inputs | Access/scope |
|---|---|---|
| `inspect_project` | none | Read only; `project:read` |
| `read_project_file` | `path` | Read only allowlist; excludes `.env`; `project:read` |
| `list_events` | optional `search`, `category` | Read only; `events:read` |
| `get_event` | `id` | Read only; `events:read` |
| `get_event_stats` | none | Read only; `events:read` |
| `check_backend_health` | none | Read only; `events:read` |
| `create_event` | `eventId`, `title`, optional `description`, `category`, `date`, `venue`, `organizer`, integer `capacity`, `status` | Writes event data; `events:write` |
| `update_event` | `id` plus one or more event fields | Writes event data; `events:write` |
| `delete_event` | `id`, `authorized: true` | Destructive write; `events:delete` and explicit confirmation |
| `check_deployment_status` | `target`: `netlify`, `render_backend`, or `render_mcp` | Read only provider API; `deployments:read` |
| `check_live_health` | `target`: `netlify_site`, `backend_api`, or `mcp_service` | Read only HTTP check; `deployments:read` |

Deployment tools only read status; this service cannot trigger production deploys. A status is reported as not configured if IDs or credentials are absent. Errors are sanitized and do not return provider credentials.

## ChatGPT authentication

Remote ChatGPT use requires `MCP_AUTH_MODE=oauth`. In this mode the service:

- Publishes `/.well-known/oauth-protected-resource`.
- Returns a `WWW-Authenticate` challenge that points ChatGPT to that metadata.
- Verifies JWT signature via the identity provider's JWKS, exact issuer, audience, expiry, and required tool scope.
- Requires separate `events:read`, `events:write`, `events:delete`, `project:read`, and `deployments:read` scopes.

The authorization server is an external identity provider; this repository is the OAuth resource server, not a homegrown login/token issuer. Configure an established OAuth 2.1/OIDC provider (OpenAI recommends an existing provider such as Auth0) to support authorization code + PKCE (`S256`), discovery metadata, refresh tokens/`offline_access`, and access tokens signed for the MCP audience. The token must contain the required API scopes in `scope` or `scp`. Set `OAUTH_ISSUER` to the exact discovery `issuer`, `OAUTH_JWKS_URL` to its published JWKS URI, and `OAUTH_AUDIENCE` to the same resource identifier advertised in `MCP_PUBLIC_URL`. Add ChatGPT's exact redirect URI from its connector setup page to the provider's allowed callback list. Do not paste provider secrets or tokens into chat.

The `bearer` mode exists only for local testing and compatible external agents. Production startup rejects bearer mode. ChatGPT does not accept arbitrary user API keys or machine-to-machine client credentials for this custom OAuth flow; use OAuth authorization code + PKCE. Custom MCP write actions are available on ChatGPT Business and Enterprise/Edu web workspaces, subject to admin permissions and action approvals. Pro users are limited to read/fetch custom MCP access. If the account cannot connect a custom OAuth MCP service, a separate application using the OpenAI API can connect to this server with a supported MCP client. That is a different integration from ChatGPT directly connecting.

## Local Windows setup

Prerequisite: Node.js 20 or newer. From the repository root in PowerShell:

```powershell
npm ci --prefix mcp
Copy-Item mcp\.env.example mcp\.env
```

Edit `mcp/.env` locally with these values:

```env
MCP_AUTH_MODE=bearer
MCP_BEARER_TOKEN=<random value with at least 32 characters>
CAMPUS_API_URL=http://localhost:5000
```

Then start Express (with its own `backend/.env` already configured) and MCP in separate terminals:

```powershell
npm run start:backend
npm run start:mcp
```

MCP listens at `http://localhost:8787/mcp`; its liveness endpoint is `http://localhost:8787/health`. Configure a local MCP client with Streamable HTTP and the bearer token from the local env file. `.env` files are gitignored. Do not use production data for write tests.

## Render hosting for MCP

`mcp/render.yaml` is an optional Blueprint manifest for a separate `campus-event-mcp` service. It does not create or change a service until you select/sync that Blueprint in Render. Before doing so, inspect the Render workspace and confirm no existing MCP service should be reused; a Blueprint service with the same name can update an existing service. It uses the free plan to avoid a paid-plan choice, and Render may spin down idle free services. Choose a paid plan manually only if you need always-on availability.

In Render, connect the existing GitHub repository, set the Blueprint file path to `mcp/render.yaml`, inspect the proposed changes, and confirm that only the intended MCP service is added or updated. Keep the existing backend service. Add environment values through Render's secret/environment UI:

- `MCP_PUBLIC_URL`: canonical HTTPS URL of this MCP service, without `/mcp`.
- `CAMPUS_API_URL`: existing Render backend URL, without trailing slash.
- `OAUTH_ISSUER`, `OAUTH_AUDIENCE`, `OAUTH_JWKS_URL`: from the OAuth provider; audience must equal the advertised MCP resource.
- `NETLIFY_ACCESS_TOKEN`, `NETLIFY_SITE_ID`, `NETLIFY_SITE_URL`: least-privilege read token, existing Netlify site ID, and live site URL.
- `RENDER_API_KEY`, `RENDER_BACKEND_SERVICE_ID`, `RENDER_MCP_SERVICE_ID`: least-privilege Render API key and the existing backend/new MCP IDs. The MCP ID is only available after the service is created.

The Blueprint sets `autoDeployTrigger: checksPass` for the MCP service. Render documents this as deploying the linked branch only after its CI checks pass. For the existing Render API service, inspect its current configuration and set the same trigger in its dashboard only after checking its current service and CI integration. The MCP manifest does not change the existing backend service.

## GitHub, Netlify, Atlas and existing backend

- **GitHub:** use the existing `master` production branch. In repository Settings → Branches, add a protection rule requiring pull requests and the Actions check `Verify application / verify` before merge. Restrict direct pushes to the protected branch. The workflow runs on pull requests and pushes to `master`; branch protection is required so production pushes happen after passing checks.
- **Netlify:** reuse the existing connected site. Confirm its production branch is `master`, base directory `frontend`, build command `npm run build`, publish directory `frontend/dist`, and `VITE_API_URL` points to the existing Render API. Set production deploys to publish only from the protected branch. Netlify publishes when changes reach its production branch; required GitHub checks on the protected branch are the gate. Do not create a second site.
- **Render backend:** reuse the existing backend service. Confirm its branch is `master`, root directory `backend`, build command `npm install` (or `npm ci` after checking its lockfile), start command `node server.js`, and `autoDeployTrigger`/dashboard setting waits for CI checks. Keep `MONGODB_URI`, `DB_NAME`, `FRONTEND_URL`, and `PORT` in Render's secret/config UI. Do not create a second backend service.
- **MongoDB Atlas:** MCP does not connect directly. Keep the existing `MONGODB_URI` and `DB_NAME=campusEventDB` only in the existing backend's secret environment; use a DB-scoped application user and Atlas network access already required by Render. No Atlas credentials belong in MCP or GitHub.
- **GitHub code edits:** MCP does not modify files or create commits/PRs. A coding agent with separately granted GitHub/repository write access must create a branch, make the reviewed change, run checks, and open a PR. This workspace has no verified GitHub write credential.

## Deployment status and health checks

Set the Netlify and Render values above to enable `check_deployment_status`. It queries the existing Netlify site deploy list and Render service deploy list read only. Set `NETLIFY_SITE_URL` to enable the live site check. `check_live_health` checks the site root, Express `/health`, or MCP `/health`; the Express route reports `DOWN`/HTTP 503 if Mongoose is disconnected. No provider status is claimed until a call succeeds with the account's actual IDs and credentials.

The backend API serves events dynamically to the React UI. A newly created event through MCP should appear after the UI refreshes/reloads its event list; it does not require rebuilding the frontend. Verify this on staging first.

## GitHub Actions verification

Run the same checks on Windows:

```powershell
npm ci --prefix backend
npm ci --prefix frontend
Push-Location mcp; npm ci; npm test; Pop-Location
node --check backend\server.js
node --check backend\controllers\eventController.js
npm run build:frontend
```

GitHub CI tests MCP tools against an isolated mock Express API, including OAuth JWT verification, invalid event input, delete authorization, provider-not-configured behavior, and health checks. It does not touch Atlas. The backend currently has syntax validation but no dedicated test suite.

## Security and remaining limitations

- OAuth user authorization protects MCP tools, but the existing Express CRUD API itself is publicly callable and has no authentication middleware. MCP OAuth does not secure direct calls to that API. Before treating production event writes as protected, separately secure the Express API and update the frontend to authenticate, or constrain API access through an approved network/API gateway. This needs an application auth design and must not be patched into production without review.
- Secrets remain in the hosting provider's secret store; `.env.example` contains variable names only. Never commit `.env`.
- `/health` is a liveness/readiness check, not a deploy-status claim. Provider state comes only from successful provider API calls.
- No code push, PR, provider configuration change, or deployment has been performed. The user's live-test request is pending GitHub write/deploy approval plus staging/API and provider access. Do not test creates, updates, or deletes on production records.

## Example prompts

- “Show events in the Workshop category and event statistics.”
- “Check whether the live Netlify site and Render backend are healthy.”
- “Show the latest Netlify and Render deployment status.”
- “Create a test event on staging with ID MCP-TEST-01.”
- “Update MCP-TEST-01's venue to the auditorium.”
- “Read `backend/models/Event.js` and summarize its validation rules.”
- “Delete MCP-TEST-01” (the client must confirm, and the tool requires `authorized: true`).
