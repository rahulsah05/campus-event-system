#!/usr/bin/env node
'use strict';

// Stateless MCP service over Streamable HTTP. All event mutations go through
// the existing Express API; this process never connects directly to MongoDB.
const http = require('node:http');
const { timingSafeEqual } = require('node:crypto');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');

const PORT = Number(process.env.PORT || process.env.MCP_PORT || 8787);
const API_URL = (process.env.CAMPUS_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const AUTH_MODE = process.env.MCP_AUTH_MODE;
const TOKEN = process.env.MCP_BEARER_TOKEN;
const MCP_PUBLIC_URL = (process.env.MCP_PUBLIC_URL || '').replace(/\/+$/, '');
const OAUTH_ISSUER = process.env.OAUTH_ISSUER;
const OAUTH_AUDIENCE = process.env.OAUTH_AUDIENCE || MCP_PUBLIC_URL;
const OAUTH_JWKS_URL = process.env.OAUTH_JWKS_URL;
const CATEGORIES = ['Workshop', 'Hackathon', 'Seminar', 'Competition', 'Cultural'];
const STATUSES = ['Upcoming', 'Ongoing', 'Completed', 'Cancelled'];
const MAX_BODY = 1024 * 1024;
const REPO_ROOT = require('node:path').resolve(__dirname, '..');
const READABLE_FILES = new Set([
  'README.md', 'package.json', 'backend/package.json', 'backend/server.js',
  'backend/routes/eventRoutes.js', 'backend/controllers/eventController.js',
  'backend/models/Event.js', 'backend/config/database.js', 'frontend/package.json',
  'frontend/vite.config.js', 'frontend/src/App.jsx', 'frontend/src/services/api.js',
  'frontend/src/components/EventModal.jsx', 'mcp/package.json', 'mcp/server.js',
  'mcp/README.md', 'mcp/server.test.js', 'mcp/render.yaml', '.github/workflows/verify.yml'
]);

if (!['bearer', 'oauth'].includes(AUTH_MODE)) {
  console.error('Set MCP_AUTH_MODE to bearer (local/compatible clients) or oauth (remote ChatGPT).');
  process.exit(1);
}
if (AUTH_MODE === 'bearer' && (!TOKEN || TOKEN.length < 32)) {
  console.error('MCP_BEARER_TOKEN must be set to a random value of at least 32 characters.');
  process.exit(1);
}
if (AUTH_MODE === 'oauth' && (!MCP_PUBLIC_URL.startsWith('https://') || !OAUTH_ISSUER?.startsWith('https://') || !OAUTH_AUDIENCE || !OAUTH_JWKS_URL)) {
  console.error('OAuth mode requires HTTPS MCP_PUBLIC_URL, OAUTH_ISSUER, OAUTH_AUDIENCE, and OAUTH_JWKS_URL.');
  process.exit(1);
}
if (AUTH_MODE === 'oauth' && OAUTH_AUDIENCE !== MCP_PUBLIC_URL) {
  console.error('OAUTH_AUDIENCE must exactly match MCP_PUBLIC_URL.');
  process.exit(1);
}
if (AUTH_MODE === 'oauth' && !OAUTH_JWKS_URL.startsWith('https://') && !(process.env.NODE_ENV === 'test' && /^http:\/\/(localhost|127\.0\.0\.1):/.test(OAUTH_JWKS_URL))) {
  console.error('OAUTH_JWKS_URL must use HTTPS outside local tests.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && AUTH_MODE !== 'oauth') {
  console.error('Production deployments require MCP_AUTH_MODE=oauth. Shared bearer tokens are for local or compatible clients only.');
  process.exit(1);
}

const eventInput = {
  eventId: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional().default(''),
  category: z.enum(CATEGORIES),
  date: z.string().min(1).refine((value) => !Number.isNaN(Date.parse(value)), 'Date must be parseable as an ISO date or timestamp'),
  venue: z.string().trim().min(1).max(200),
  organizer: z.string().trim().min(1).max(200),
  capacity: z.number().int().min(1).max(1000000),
  status: z.enum(STATUSES)
};
const updateInput = Object.fromEntries(Object.entries(eventInput).map(([key, value]) => [key, value.optional()]));

async function api(path, { method = 'GET', body, acceptError = false } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok && !acceptError) throw new Error(data.message || `Campus API returned HTTP ${response.status}`);
    if (!response.ok) data.httpStatus = response.status;
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function escapeSearchTerm(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function requireScope(auth, scope) {
  if (AUTH_MODE === 'bearer') return;
  if (!auth || !auth.scopes.has(scope)) throw new Error(`The access token requires the ${scope} scope.`);
}

function createMcpServer(auth) {
  const server = new McpServer({ name: 'campus-event-system', version: '1.0.0' });
  server.tool('inspect_project', 'Read the tracked project file list. Does not expose environment files or secrets.', {}, async () => {
    requireScope(auth, 'project:read');
    const { execFile } = require('node:child_process');
    const { promisify } = require('node:util');
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync('git', ['ls-files'], { cwd: REPO_ROOT, timeout: 5000, windowsHide: true, maxBuffer: 1024 * 1024 });
    return { content: [{ type: 'text', text: stdout.split(/\r?\n/).filter(Boolean).join('\n') }] };
  });
  server.tool('read_project_file', 'Read a specific allowlisted project source or configuration file. Secrets and .env files are excluded.', {
    path: z.string().trim().min(1).max(200)
  }, async ({ path: inputPath }) => {
    requireScope(auth, 'project:read');
    const normalized = inputPath.replaceAll('\\', '/').replace(/^\.\//, '');
    if (!READABLE_FILES.has(normalized)) throw new Error('This path is not allowlisted for MCP reading.');
    const absolute = require('node:path').resolve(REPO_ROOT, normalized);
    if (!absolute.startsWith(`${REPO_ROOT}${require('node:path').sep}`)) throw new Error('Path is outside the repository.');
    const content = await require('node:fs/promises').readFile(absolute, 'utf8');
    if (content.length > 40000) throw new Error('File is too large to return.');
    return { content: [{ type: 'text', text: content }] };
  });
  server.tool('list_events', 'List and search campus events. Optional category must match a supported category.', {
    search: z.string().max(200).optional(), category: z.enum(CATEGORIES).optional()
  }, async ({ search, category }) => {
    requireScope(auth, 'events:read');
    const query = new URLSearchParams();
    if (search) query.set('search', escapeSearchTerm(search));
    if (category) query.set('category', category);
    const result = await api(`/api/events${query.size ? `?${query}` : ''}`);
    return { content: [{ type: 'text', text: JSON.stringify(result.data) }] };
  });
  server.tool('get_event', 'Retrieve one event by its event ID or MongoDB ID.', { id: z.string().trim().min(1).max(100) }, async ({ id }) => {
    requireScope(auth, 'events:read');
    const result = await api(`/api/events/${encodeURIComponent(id)}`);
    return { content: [{ type: 'text', text: JSON.stringify(result.data) }] };
  });
  server.tool('get_event_stats', 'Read total and per-status event counts.', {}, async () => {
    requireScope(auth, 'events:read');
    const result = await api('/api/events/stats/summary');
    return { content: [{ type: 'text', text: JSON.stringify(result.data) }] };
  });
  server.tool('create_event', 'Create an event through the application API. Input is validated before submission.', eventInput, async (input) => {
    requireScope(auth, 'events:write');
    const value = eventInputSchema.parse(input);
    const result = await api('/api/events', { method: 'POST', body: value });
    return { content: [{ type: 'text', text: JSON.stringify(result.data) }] };
  });
  server.tool('update_event', 'Update an event through the application API. Include only fields to change.', {
    id: z.string().trim().min(1).max(100), ...updateInput
  }, async ({ id, ...input }) => {
    requireScope(auth, 'events:write');
    const value = updateEventInputSchema.parse(input);
    if (!Object.keys(value).length) throw new Error('Provide at least one event field to update.');
    const result = await api(`/api/events/${encodeURIComponent(id)}`, { method: 'PUT', body: value });
    return { content: [{ type: 'text', text: JSON.stringify(result.data) }] };
  });
  server.tool('delete_event', 'Permanently delete an event. Requires explicit authorized=true in the same call.', {
    id: z.string().trim().min(1).max(100), authorized: z.literal(true)
  }, async ({ id, authorized }) => {
    requireScope(auth, 'events:delete');
    if (authorized !== true) throw new Error('Deletion requires explicit authorization.');
    const result = await api(`/api/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return { content: [{ type: 'text', text: JSON.stringify(result.data) }] };
  });
  server.tool('check_backend_health', 'Check the configured campus backend health endpoint.', {}, async () => {
    requireScope(auth, 'events:read');
    const result = await api('/health', { acceptError: true });
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });
  server.tool('check_deployment_status', 'Read the latest Netlify site or Render service deployment. Returns not_configured when the related service credentials or ID are absent.', {
    target: z.enum(['netlify', 'render_backend', 'render_mcp'])
  }, async ({ target }) => {
    requireScope(auth, 'deployments:read');
    try {
      if (target === 'netlify') {
        if (!process.env.NETLIFY_ACCESS_TOKEN || !process.env.NETLIFY_SITE_ID) return { content: [{ type: 'text', text: JSON.stringify({ configured: false, target, status: 'not_configured' }) }] };
        const base = (process.env.NETLIFY_API_BASE_URL || 'https://api.netlify.com/api/v1').replace(/\/+$/, '');
        const rows = await providerRequest(`${base}/sites/${encodeURIComponent(process.env.NETLIFY_SITE_ID)}/deploys?per_page=1`, process.env.NETLIFY_ACCESS_TOKEN);
        const deploy = Array.isArray(rows) ? rows[0] : null;
        return { content: [{ type: 'text', text: JSON.stringify({ configured: true, target, id: deploy?.id, state: deploy?.state, created_at: deploy?.created_at, deploy_url: deploy?.deploy_url }) }] };
      }
      const serviceId = target === 'render_backend' ? process.env.RENDER_BACKEND_SERVICE_ID : process.env.RENDER_MCP_SERVICE_ID;
      if (!process.env.RENDER_API_KEY || !serviceId) return { content: [{ type: 'text', text: JSON.stringify({ configured: false, target, status: 'not_configured' }) }] };
      const base = (process.env.RENDER_API_BASE_URL || 'https://api.render.com/v1').replace(/\/+$/, '');
      const rows = await providerRequest(`${base}/services/${encodeURIComponent(serviceId)}/deploys?limit=1`, process.env.RENDER_API_KEY);
      const deploy = Array.isArray(rows) ? (rows[0]?.deploy || rows[0]) : null;
      return { content: [{ type: 'text', text: JSON.stringify({ configured: true, target, id: deploy?.id, status: deploy?.status, createdAt: deploy?.createdAt, updatedAt: deploy?.updatedAt }) }] };
    } catch {
      return { content: [{ type: 'text', text: JSON.stringify({ configured: true, target, status: 'error', message: 'Provider status request failed; check service credentials, identifier, and provider availability.' }) }] };
    }
  });
  server.tool('check_live_health', 'Check live website availability, backend readiness, or MCP service liveness without changing data.', {
    target: z.enum(['netlify_site', 'backend_api', 'mcp_service'])
  }, async ({ target }) => {
    requireScope(auth, 'deployments:read');
    const base = target === 'netlify_site' ? process.env.NETLIFY_SITE_URL
      : target === 'backend_api' ? API_URL : MCP_PUBLIC_URL;
    if (!base) return { content: [{ type: 'text', text: JSON.stringify({ configured: false, target, status: 'not_configured' }) }] };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const url = target === 'backend_api' ? `${base}/health`
        : target === 'mcp_service' ? `${base}/health` : base;
      const response = await fetch(url, { signal: controller.signal, redirect: 'manual' });
      const body = target === 'backend_api' ? await response.json().catch(() => ({})) : undefined;
      return { content: [{ type: 'text', text: JSON.stringify({ configured: true, target, httpStatus: response.status, healthy: response.ok && (target !== 'backend_api' || body.status === 'UP'), ...(body || {}) }) }] };
    } catch {
      return { content: [{ type: 'text', text: JSON.stringify({ configured: true, target, healthy: false, status: 'unreachable' }) }] };
    } finally { clearTimeout(timeout); }
  });
  return server;
}

const eventInputSchema = z.object(eventInput);
const updateEventInputSchema = z.object(updateInput).strict();

function constantTimeTokenCheck(header) {
  if (!header || !header.startsWith('Bearer ')) return false;
  const candidate = Buffer.from(header.slice(7));
  const expected = Buffer.from(TOKEN);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

async function authenticate(header) {
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  if (AUTH_MODE === 'bearer') {
    return constantTimeTokenCheck(header)
      ? { scopes: new Set(['project:read', 'events:read', 'events:write', 'events:delete', 'deployments:read']) }
      : null;
  }
  try {
    const { createRemoteJWKSet, jwtVerify } = await import('jose');
    if (!authenticate.jwks) authenticate.jwks = createRemoteJWKSet(new URL(OAUTH_JWKS_URL));
    const { payload } = await jwtVerify(token, authenticate.jwks, {
      issuer: OAUTH_ISSUER,
      audience: OAUTH_AUDIENCE
    });
    const scopes = typeof payload.scope === 'string'
      ? payload.scope.split(/\s+/).filter(Boolean)
      : Array.isArray(payload.scp) ? payload.scp : [];
    return { subject: payload.sub, scopes: new Set(scopes) };
  } catch {
    return null;
  }
}

function oauthChallenge() {
  const metadata = `${MCP_PUBLIC_URL}/.well-known/oauth-protected-resource`;
  return `Bearer resource_metadata="${metadata}", scope="events:read events:write events:delete project:read deployments:read"`;
}

async function providerRequest(url, token, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('Request body too large.');
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
}

// Stateless requests avoid in-memory session state and work behind ordinary HTTPS hosts.
const httpServer = http.createServer(async (req, res) => {
  if (req.url === '/.well-known/oauth-protected-resource' && req.method === 'GET' && AUTH_MODE === 'oauth') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' });
    return res.end(JSON.stringify({
      resource: MCP_PUBLIC_URL,
      authorization_servers: [OAUTH_ISSUER],
      scopes_supported: ['events:read', 'events:write', 'events:delete', 'project:read', 'deployments:read'],
      bearer_methods_supported: ['header']
    }));
  }
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ status: 'UP', service: 'campus-event-mcp' }));
  }
  if (req.url !== '/mcp') {
    res.writeHead(404).end();
    return;
  }
  const auth = await authenticate(req.headers.authorization);
  if (!auth) {
    res.writeHead(401, { 'www-authenticate': AUTH_MODE === 'oauth' ? oauthChallenge() : 'Bearer', 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Unauthorized' }));
  }
  if (!['POST', 'GET', 'DELETE'].includes(req.method)) {
    res.writeHead(405, { allow: 'GET, POST, DELETE' }).end();
    return;
  }
  try {
    const body = req.method === 'POST' ? await readBody(req) : undefined;
    const server = createMcpServer(auth);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (error) {
    if (!res.headersSent) res.writeHead(400, { 'content-type': 'application/json' });
    if (!res.writableEnded) res.end(JSON.stringify({ error: 'Invalid MCP request' }));
    console.error(`MCP request failed: ${error.message}`);
  }
});

httpServer.listen(PORT, '0.0.0.0', () => console.log(`Campus Event MCP listening on port ${PORT}`));
