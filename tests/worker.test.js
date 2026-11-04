import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTedRequest, handleRequest, normalizeNotice, parseParams } from '../src/index.js';

const base = 'https://example.workers.dev';

test('parametrii impliciți generează query TED valid structural', () => {
  const params = parseParams(new URL(`${base}/api/search`));
  const req = buildTedRequest(params, new Date('2026-11-03T00:00:00Z'));
  assert.equal(params.country, 'ROU');
  assert.equal(req.query, 'buyer-country=ROU AND publication-date>=20261004 SORT BY publication-date DESC');
  assert.equal(req.scope, 'ACTIVE');
  assert.ok(req.fields.includes('notice-title'));
});

test('filtrul CPV este validat și inclus', () => {
  const params = parseParams(new URL(`${base}/api/search?country=DEU&cpv=72000000&limit=5`));
  assert.match(buildTedRequest(params).query, /classification-cpv=72000000/);
  assert.throws(() => parseParams(new URL(`${base}/api/search?cpv=hello`)));
  assert.throws(() => parseParams(new URL(`${base}/api/search?country=ROU%20OR%20ALL`)));
  assert.throws(() => parseParams(new URL(`${base}/api/search?days=1000`)));
});

test('normalizează câmpuri TED multilingve fără a inventa valori', () => {
  assert.deepEqual(normalizeNotice({
    'publication-number': '123456-2026',
    'notice-title': { ron: ['Contract servicii'], eng: ['Services contract'] },
    'buyer-name': { ron: ['Primăria Exemplu'] },
    'buyer-country': 'ROU',
    'publication-date': '2026-10-30+02:00',
    'deadline': ['2026-11-30Z'],
    'classification-cpv': ['72000000', '72000000']
  }), {
    publication_number: '123456-2026', title: 'Contract servicii',
    buyer: 'Primăria Exemplu', country: 'ROU', publication_date: '2026-10-30',
    deadline_date: '2026-11-30', cpv: ['72000000'], notice_type: null,
    source_url: 'https://ted.europa.eu/en/notice/-/detail/123456-2026'
  });
});

test('GET /api/search returnează JSON cu date normalizate', async () => {
  let called = false;
  const mockFetch = async (url, options) => {
    called = true;
    assert.equal(url, 'https://api.ted.europa.eu/v3/notices/search');
    assert.equal(options.method, 'POST');
    const body = JSON.parse(options.body);
    assert.equal(body.limit, 2);
    return new Response(JSON.stringify({ totalNoticeCount: 1, notices: [{
      'publication-number': '456789-2026', 'notice-title': { eng: ['Example tender'] }
    }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await handleRequest(new Request(`${base}/api/search?limit=2`), mockFetch);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).results[0].title, 'Example tender');
  assert.ok(called);
});

test('date invalide sunt respinse fără apel TED', async () => {
  const response = await handleRequest(new Request(`${base}/api/search?cpv=123`), () => { throw new Error('nu trebuie apelat'); });
  assert.equal(response.status, 400);
});

test('erorile upstream sunt tratate ca 502', async () => {
  const response = await handleRequest(new Request(`${base}/api/search`), async () => new Response('unavailable', { status: 503 }));
  assert.equal(response.status, 502);
});

test('interfața HTML și endpointul de health funcționează', async () => {
  const html = await handleRequest(new Request(`${base}/`));
  assert.equal(html.status, 200);
  assert.match(await html.text(), /EU Tender Intelligence/);
  const health = await handleRequest(new Request(`${base}/api/health`));
  assert.equal((await health.json()).status, 'ok');
});

const MCP_URL = `${base}/mcp`;
function mcpRequest(method, params = {}, opts = {}) {
  const modern = opts.modern === true;
  const headers = {
    'content-type': 'application/json',
    'accept': 'application/json, text/event-stream',
  };
  if (modern) {
    headers['MCP-Protocol-Version'] = '2026-07-28';
    headers['Mcp-Method'] = method;
    if (method === 'tools/call') headers['Mcp-Name'] = params.name;
    params = { ...params, _meta: {
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientCapabilities': {},
      'io.modelcontextprotocol/clientInfo': { name: 'test-client', version: '1.0' }
    } };
  }
  return new Request(MCP_URL, {
    method: 'POST', headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
}

test('MCP 2025 initialize returnează identificarea și capabilitățile serverului', async () => {
  const r = await handleRequest(mcpRequest('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name:'test', version:'1.0' } }));
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.result.protocolVersion, '2025-11-25');
  assert.ok(d.result.capabilities.tools);
  assert.equal(d.result.serverInfo.version, '0.2.0');
});

test('MCP modern server/discover listează versiunile', async () => {
  const r = await handleRequest(mcpRequest('server/discover', {}, { modern: true }));
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.result.resultType, 'complete');
  assert.ok(d.result.supportedVersions.includes('2026-07-28'));
});

test('MCP tools/list expune un instrument cu schema JSON', async () => {
  const r = await handleRequest(mcpRequest('tools/list', {}, { modern: true }));
  const d = await r.json();
  assert.equal(d.result.tools[0].name, 'search_tenders');
  assert.equal(d.result.tools[0].inputSchema.properties.limit.maximum, 25);
});

test('MCP tools/call funcționează cu TED simulat, fără API extern', async () => {
  const mockFetch = async () => new Response(JSON.stringify({ totalNoticeCount: 1, notices: [{
    'publication-number': '111111-2026', 'notice-title': { ron:['Contract test'] }
  }] }), { status: 200 });
  const r = await handleRequest(mcpRequest('tools/call', {
    name:'search_tenders', arguments:{ country:'ROU', days:7, limit:2 }
  }, { modern: true }), mockFetch);
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.result.structuredContent.results[0].title, 'Contract test');
  assert.equal(d.result.content[0].type, 'text');
});

test('MCP respinge parametri invalizi fără TED upstream', async () => {
  const r = await handleRequest(mcpRequest('tools/call', {
    name: 'search_tenders', arguments: { cpv: 'wrong' }
  }), () => { throw new Error('not called'); });
  const d = await r.json();
  assert.equal(d.result.isError, true);
});

test('MCP GET respins explicit, cu mesaj explicativ', async () => {
  const r = await handleRequest(new Request(MCP_URL));
  assert.equal(r.status, 405);
});

test('MCP Origin extern este respins', async () => {
  const r = new Request(MCP_URL, { method: 'POST', headers: {
    origin:'https://evil.example', accept:'application/json, text/event-stream',
    'content-type':'application/json'
  }, body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'tools/list', params:{} }) });
  const res = await handleRequest(r);
  assert.equal(res.status, 403);
});

test('MCP info vizibil și health actualizat', async () => {
  const info = await (await handleRequest(new Request(`${base}/mcp-info`))).json();
  const health = await (await handleRequest(new Request(`${base}/api/health`))).json();
  assert.equal(info.tools[0], 'search_tenders');
  assert.equal(health.version, '0.2.0');
});
