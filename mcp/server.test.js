'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { CallToolResultSchema } = require('@modelcontextprotocol/sdk/types.js');

const TOKEN = 'test-mcp-token-that-is-long-enough-1234567890';
let apiServer;
let renderMock;
let mcpProcess;
let client;
let transport;
let mcpPort;
const events = new Map();
let fakeHealth = { status: 'UP', database: 'connected' };

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

before(async () => {
  renderMock = http.createServer((req, res) => {
    if (req.url.startsWith('/sites/netlify-test-site/deploys')) {
      assert.equal(req.headers.authorization, 'Bearer netlify-test-token');
      return json(res, 200, [{ id: 'netlify-deploy-test', state: 'ready', created_at: '2026-01-02T00:00:00.000Z', deploy_url: 'https://deploy-test.netlify.app' }]);
    }
    assert.equal(req.url, '/services/test-service/deploys?limit=1');
    assert.equal(req.headers.authorization, 'Bearer render-test-token');
    return json(res, 200, [{ deploy: { id: 'dep-test-01', status: 'live', createdAt: '2026-01-01T00:00:00.000Z' } }]);
  });
  await new Promise((resolve) => renderMock.listen(0, '127.0.0.1', resolve));
  apiServer = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/health') return json(res, fakeHealth.status === 'UP' ? 200 : 503, fakeHealth);
    if (url.pathname === '/api/events/stats/summary') return json(res, 200, { success: true, data: { totalEvents: events.size, upcoming: events.size, ongoing: 0, completed: 0, cancelled: 0 } });
    if (url.pathname === '/api/events' && req.method === 'GET') {
      let values = [...events.values()];
      const category = url.searchParams.get('category');
      const search = url.searchParams.get('search');
      if (category) values = values.filter((event) => event.category === category);
      if (search) values = values.filter((event) => JSON.stringify(event).toLowerCase().includes(search.toLowerCase()));
      return json(res, 200, { success: true, data: values });
    }
    if (url.pathname === '/api/events' && req.method === 'POST') {
      const body = await readJson(req);
      if (events.has(body.eventId)) return json(res, 400, { message: 'duplicate eventId' });
      events.set(body.eventId, body);
      return json(res, 201, { success: true, data: body });
    }
    const match = url.pathname.match(/^\/api\/events\/([^/]+)$/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      if (!events.has(id)) return json(res, 404, { message: 'Event not found' });
      if (req.method === 'GET') return json(res, 200, { success: true, data: events.get(id) });
      if (req.method === 'PUT') {
        const body = await readJson(req);
        const updated = { ...events.get(id), ...body };
        events.set(id, updated);
        return json(res, 200, { success: true, data: updated });
      }
      if (req.method === 'DELETE') {
        const [deleted] = [events.get(id)];
        events.delete(id);
        return json(res, 200, { success: true, data: deleted });
      }
    }
    return json(res, 404, { message: 'not found' });
  });
  await new Promise((resolve) => apiServer.listen(0, '127.0.0.1', resolve));

  const probe = http.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  mcpPort = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  mcpProcess = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: 'test', MCP_AUTH_MODE: 'bearer', PORT: String(mcpPort), MCP_BEARER_TOKEN: TOKEN,
      NETLIFY_ACCESS_TOKEN: 'netlify-test-token', NETLIFY_SITE_ID: 'netlify-test-site', NETLIFY_API_BASE_URL: `http://127.0.0.1:${renderMock.address().port}`,
      RENDER_MCP_SERVICE_ID: '',
      RENDER_API_KEY: 'render-test-token', RENDER_BACKEND_SERVICE_ID: 'test-service', RENDER_API_BASE_URL: `http://127.0.0.1:${renderMock.address().port}`,
      CAMPUS_API_URL: `http://127.0.0.1:${apiServer.address().port}` },
    stdio: 'ignore', windowsHide: true
  });
  await waitForHealth(`http://127.0.0.1:${mcpPort}/health`);

  client = new Client({ name: 'campus-event-mcp-tests', version: '1.0.0' });
  transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${mcpPort}/mcp`), {
    requestInit: { headers: { authorization: `Bearer ${TOKEN}` } }
  });
  await client.connect(transport);
});

after(async () => {
  if (transport) await transport.close().catch(() => {});
  if (mcpProcess && mcpProcess.exitCode === null) mcpProcess.kill();
  if (apiServer) await new Promise((resolve) => apiServer.close(resolve));
  if (renderMock) await new Promise((resolve) => renderMock.close(resolve));
});

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch (error) { reject(error); } });
  });
}

async function waitForHealth(url, processToWatch = mcpProcess) {
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    if (processToWatch.exitCode !== null) throw new Error(`MCP server exited with ${processToWatch.exitCode}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('MCP server did not become healthy.');
}

async function call(name, args = {}) {
  return client.request({ method: 'tools/call', params: { name, arguments: args } }, CallToolResultSchema);
}

test('requires authentication for the MCP endpoint', async () => {
  const response = await fetch(`http://127.0.0.1:${mcpPort}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 401);
});

test('exposes project and event read tools', async () => {
  const { tools } = await client.listTools();
  const names = tools.map((tool) => tool.name);
  for (const name of ['inspect_project', 'read_project_file', 'list_events', 'get_event', 'get_event_stats', 'check_backend_health', 'create_event', 'update_event', 'delete_event', 'check_deployment_status', 'check_live_health']) assert.ok(names.includes(name));
  const project = await call('read_project_file', { path: 'backend/models/Event.js' });
  assert.match(project.content[0].text, /CATEGORIES/);
  assert.equal((await call('read_project_file', { path: 'backend/.env.example' })).isError, true);
});

test('supports event list, category search, event lookup, statistics, and health', async () => {
  const list = await call('list_events');
  assert.deepEqual(JSON.parse(list.content[0].text), []);
  const health = await call('check_backend_health');
  assert.equal(JSON.parse(health.content[0].text).status, 'UP');
  fakeHealth = { status: 'DOWN', database: 'disconnected' };
  const unavailable = await call('check_backend_health');
  assert.equal(JSON.parse(unavailable.content[0].text).status, 'DOWN');
  fakeHealth = { status: 'UP', database: 'connected' };
  const stats = await call('get_event_stats');
  assert.equal(JSON.parse(stats.content[0].text).totalEvents, 0);
});

test('creates and updates an event and rejects invalid data', async () => {
  const event = { eventId: 'MCP-TEST-01', title: 'Test Event', category: 'Workshop', date: '2027-01-05T10:00:00.000Z', venue: 'Test Hall', organizer: 'Test Club', capacity: 50, status: 'Upcoming' };
  const created = await call('create_event', event);
  assert.equal(JSON.parse(created.content[0].text).eventId, event.eventId);
  const filtered = await call('list_events', { category: 'Workshop' });
  assert.equal(JSON.parse(filtered.content[0].text).length, 1);
  const searched = await call('list_events', { search: 'Test Event' });
  assert.equal(JSON.parse(searched.content[0].text).length, 1);
  const lookedUp = await call('get_event', { id: event.eventId });
  assert.equal(JSON.parse(lookedUp.content[0].text).title, 'Test Event');
  assert.equal((await call('create_event', { ...event, eventId: 'BAD-TEST', capacity: 0 })).isError, true);
  const updated = await call('update_event', { id: event.eventId, venue: 'Updated Hall' });
  assert.equal(JSON.parse(updated.content[0].text).venue, 'Updated Hall');
  const stats = await call('get_event_stats');
  assert.equal(JSON.parse(stats.content[0].text).totalEvents, 1);
});

test('requires explicit delete authorization', async () => {
  assert.equal((await call('delete_event', { id: 'MCP-TEST-01' })).isError, true);
  const deleted = await call('delete_event', { id: 'MCP-TEST-01', authorized: true });
  assert.equal(JSON.parse(deleted.content[0].text).eventId, 'MCP-TEST-01');
});

test('reads provider deployment status and reports missing service IDs without claiming a connection', async () => {
  const result = await call('check_deployment_status', { target: 'netlify' });
  assert.deepEqual(JSON.parse(result.content[0].text), {
    configured: true, target: 'netlify', id: 'netlify-deploy-test', state: 'ready',
    created_at: '2026-01-02T00:00:00.000Z', deploy_url: 'https://deploy-test.netlify.app'
  });
  const render = await call('check_deployment_status', { target: 'render_backend' });
  assert.deepEqual(JSON.parse(render.content[0].text), {
    configured: true, target: 'render_backend', id: 'dep-test-01', status: 'live', createdAt: '2026-01-01T00:00:00.000Z'
  });
  const missing = await call('check_deployment_status', { target: 'render_mcp' });
  assert.deepEqual(JSON.parse(missing.content[0].text), { configured: false, target: 'render_mcp', status: 'not_configured' });
});

test('supports ChatGPT OAuth resource discovery and verifies tokens and tool scopes', async () => {
  const { generateKeyPair, exportJWK, SignJWT } = await import('jose');
  const { privateKey, publicKey } = await generateKeyPair('RS256', { modulusLength: 2048 });
  const jwk = await exportJWK(publicKey);
  Object.assign(jwk, { kid: 'oauth-test-key', alg: 'RS256', use: 'sig' });
  const issuer = 'https://identity.example.test/';
  const audience = 'https://mcp.example.test';
  const jwksServer = http.createServer((req, res) => json(res, 200, { keys: [jwk] }));
  await new Promise((resolve) => jwksServer.listen(0, '127.0.0.1', resolve));
  const probe = http.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const oauthPort = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const oauthProcess = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: 'test', MCP_AUTH_MODE: 'oauth', PORT: String(oauthPort),
      NETLIFY_ACCESS_TOKEN: '', NETLIFY_SITE_ID: '', RENDER_API_KEY: '', RENDER_BACKEND_SERVICE_ID: '', RENDER_MCP_SERVICE_ID: '',
      MCP_PUBLIC_URL: audience, OAUTH_ISSUER: issuer, OAUTH_AUDIENCE: audience,
      OAUTH_JWKS_URL: `http://127.0.0.1:${jwksServer.address().port}/jwks`,
      CAMPUS_API_URL: `http://127.0.0.1:${apiServer.address().port}` },
    stdio: 'ignore', windowsHide: true
  });
  let oauthTransport;
  try {
    await waitForHealth(`http://127.0.0.1:${oauthPort}/health`, oauthProcess);
    const metadataResponse = await fetch(`http://127.0.0.1:${oauthPort}/.well-known/oauth-protected-resource`);
    const metadata = await metadataResponse.json();
    assert.equal(metadataResponse.status, 200);
    assert.equal(metadata.resource, audience);
    assert.deepEqual(metadata.authorization_servers, [issuer]);
    const challenge = await fetch(`http://127.0.0.1:${oauthPort}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(challenge.status, 401);
    assert.match(challenge.headers.get('www-authenticate'), /oauth-protected-resource/);

    const token = await new SignJWT({ scope: 'events:read' }).setProtectedHeader({ alg: 'RS256', kid: 'oauth-test-key' })
      .setIssuer(issuer).setAudience(audience).setSubject('test-user').setIssuedAt().setExpirationTime('2m').sign(privateKey);
    const oauthClient = new Client({ name: 'oauth-integration-test', version: '1.0.0' });
    oauthTransport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${oauthPort}/mcp`), {
      requestInit: { headers: { authorization: `Bearer ${token}` } }
    });
    await oauthClient.connect(oauthTransport);
    const stats = await oauthClient.request({ method: 'tools/call', params: { name: 'get_event_stats', arguments: {} } }, CallToolResultSchema);
    assert.equal(JSON.parse(stats.content[0].text).totalEvents, 0);
    const denied = await oauthClient.request({ method: 'tools/call', params: { name: 'create_event', arguments: {
      eventId: 'SCOPE-TEST', title: 'Scope test', category: 'Workshop', date: '2027-01-05', venue: 'Test Hall', organizer: 'Test Club', capacity: 5, status: 'Upcoming'
    } } }, CallToolResultSchema);
    assert.equal(denied.isError, true);
  } finally {
    if (oauthTransport) await oauthTransport.close().catch(() => {});
    if (oauthProcess.exitCode === null) oauthProcess.kill();
    await new Promise((resolve) => jwksServer.close(resolve));
  }
});
