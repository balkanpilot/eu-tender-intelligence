/**
 * EU Tender Intelligence — free v0.3 MCP prototype.
 * Source: Publications Office of the EU / TED Search API v3.
 * No API keys, payments, or user accounts. Free, read-only MCP.
 */
const TED_ENDPOINT = 'https://api.ted.europa.eu/v3/notices/search';
const FIELDS = [
  'publication-number',
  'notice-title',
  'buyer-name',
  'buyer-country',
  'publication-date',
  'classification-cpv',
  'deadline',
  'notice-type'
];

const DEFAULTS = { country: 'ROU', days: 30, limit: 10, scope: 'ACTIVE' };

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...extra
    }
  });
}

function pickText(value, preferred = ['eng', 'ron', 'fra', 'deu']) {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    for (const part of value) {
      const text = pickText(part, preferred);
      if (text) return text;
    }
    return null;
  }
  if (typeof value === 'object') {
    for (const language of preferred) {
      if (language in value) {
        const result = pickText(value[language], preferred);
        if (result) return result;
      }
    }
    for (const part of Object.values(value)) {
      const result = pickText(part, preferred);
      if (result) return result;
    }
  }
  return null;
}

function flattenCodes(value) {
  if (value == null) return [];
  if (typeof value === 'string' || typeof value === 'number') return [String(value)];
  if (Array.isArray(value)) return [...new Set(value.flatMap(flattenCodes))];
  if (typeof value === 'object') return [...new Set(Object.values(value).flatMap(flattenCodes))];
  return [];
}

function dateOnly(value) {
  const raw = pickText(value);
  return raw?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

export function normalizeNotice(notice) {
  const id = pickText(notice['publication-number']);
  return {
    publication_number: id,
    title: pickText(notice['notice-title']),
    buyer: pickText(notice['buyer-name']),
    country: pickText(notice['buyer-country']),
    publication_date: dateOnly(notice['publication-date']),
    deadline_date: dateOnly(notice['deadline']),
    cpv: flattenCodes(notice['classification-cpv']),
    notice_type: pickText(notice['notice-type']),
    source_url: id && /^\d{1,8}-\d{4}$/.test(id)
      ? `https://ted.europa.eu/en/notice/-/detail/${id}` : null
  };
}

function positiveInt(value, name, min, max) {
  if (!/^\d+$/.test(String(value))) throw new Error(`${name} must be an integer.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(`${name} must be between ${min} and ${max}.`);
  }
  return number;
}

export function parseParams(url) {
  const country = (url.searchParams.get('country') || DEFAULTS.country).toUpperCase();
  const cpv = url.searchParams.get('cpv') || null;
  const days = positiveInt(url.searchParams.get('days') || DEFAULTS.days, 'days', 1, 365);
  const limit = positiveInt(url.searchParams.get('limit') || DEFAULTS.limit, 'limit', 1, 25);
  const scope = (url.searchParams.get('scope') || DEFAULTS.scope).toUpperCase();
  if (!/^[A-Z]{3}$/.test(country)) throw new Error('country must be a three-letter ISO-3 code, e.g. ROU.');
  if (cpv !== null && !/^\d{8}$/.test(cpv)) throw new Error('cpv must contain exactly 8 digits.');
  if (!['ACTIVE', 'ALL'].includes(scope)) throw new Error('scope must be ACTIVE or ALL.');
  return { country, cpv, days, limit, scope };
}

export function buildTedRequest(params, now = new Date()) {
  const since = new Date(now.getTime() - params.days * 86400000)
    .toISOString().slice(0, 10).replaceAll('-', '');
  const parts = [`buyer-country=${params.country}`, `publication-date>=${since}`];
  if (params.cpv) parts.push(`classification-cpv=${params.cpv}`);
  return {
    query: `${parts.join(' AND ')} SORT BY publication-date DESC`,
    fields: FIELDS,
    page: 1,
    limit: params.limit,
    scope: params.scope,
    paginationMode: 'PAGE_NUMBER'
  };
}

const PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>EU Tender Intelligence · Free demo</title>
  <style>
    :root{color-scheme:light;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
    *{box-sizing:border-box}body{margin:0;background:#f3f6fa;color:#192a3a}
    main{max-width:950px;margin:45px auto;padding:0 18px}header{margin-bottom:26px}
    h1{margin:0 0 5px;font-size:clamp(24px,4vw,38px)}p{line-height:1.55;color:#526578}
    .panel,.result{background:white;border:1px solid #e0e7ef;border-radius:14px;padding:20px;box-shadow:0 4px 20px #10253a09}
    form{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
    label{font-size:13px;font-weight:650;display:block;margin-bottom:6px}input,select,button{width:100%;height:42px;border-radius:9px;border:1px solid #bccbdb;padding:0 11px;background:white;color:inherit;font-size:15px}
    button{background:#0e5ec6;color:white;cursor:pointer;border:0;font-weight:650}button:disabled{opacity:.6;cursor:wait}
    #results{display:grid;gap:12px;margin-top:20px}.result h2{font-size:18px;margin:0 0 5px}.result p{margin:6px 0;font-size:14px}
    .meta{font-size:13px;color:#546778;margin:12px 0}a{color:#0759b5}.hint{font-size:13px}.wide{grid-column:span 4}
    @media(max-width:640px){form{grid-template-columns:1fr 1fr}.wide{grid-column:span 2}main{margin-top:24px}}
  </style>
</head>
<body><main>
  <header><h1>EU Tender Intelligence</h1><p>Free v0.3 demo — search European public procurement notices from official TED data. No account required.</p></header>
  <section class="panel">
    <form id="form">
      <div><label for="country">Buyer country</label><select id="country" name="country"><option value="ROU">Romania</option><option value="DEU">Germany</option><option value="FRA">France</option><option value="ITA">Italy</option><option value="ESP">Spain</option><option value="POL">Poland</option><option value="HUN">Hungary</option></select></div>
      <div><label for="days">Published within</label><select id="days" name="days"><option value="7">7</option><option value="30" selected>30</option><option value="90">90</option><option value="365">365</option></select></div>
      <div><label for="cpv">CPV (optional)</label><input id="cpv" name="cpv" placeholder="e.g. 72000000" pattern="[0-9]{8}" maxlength="8"></div>
      <div><label for="limit">Max results</label><select id="limit" name="limit"><option>5</option><option selected>10</option><option>20</option></select></div>
      <div class="wide"><button id="search" type="submit">Search TED</button></div>
    </form>
    <p class="hint">TED status ACTIVE does not guarantee that bidding is still open. Always verify the original notice.</p>
  </section>
  <p id="status" role="status">Choose filters and click “Search TED”.</p><section id="results"></section>
  <p class="hint">Developer API: <a href="/mcp-info">/mcp-info</a> · <a href="/openapi.json">/openapi.json</a> · <a href="/api/health">/api/health</a> · Data source: <a href="https://ted.europa.eu/">TED — Publications Office of the EU</a>.</p>
</main>
<script>
const f=document.getElementById('form'),b=document.getElementById('search'),s=document.getElementById('status'),out=document.getElementById('results');
function el(tag,text,cls){const x=document.createElement(tag);if(text)x.textContent=text;if(cls)x.className=cls;return x;}
f.addEventListener('submit',async e=>{
  e.preventDefault();b.disabled=true;s.textContent='Searching TED...';out.replaceChildren();
  const p=new URLSearchParams(new FormData(f));p.set('scope','ACTIVE');
  try{
    const r=await fetch('/api/search?'+p.toString());const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Unknown error');
    s.textContent='Results displayed: '+d.count+' · Total reported by TED: '+(d.total_from_ted??'unknown');
    if(!d.results.length)out.append(el('p','No notices found. Try a longer date range or remove the CPV filter.'));
    for(const n of d.results){
      const card=el('article',null,'result');card.append(el('h2',n.title||'Untitled notice'));
      card.append(el('p','Buyer: '+(n.buyer||'Not specified')));
      card.append(el('p','Published: '+(n.publication_date||'—')+' · Deadline: '+(n.deadline_date||'not specified')));
      card.append(el('p','CPV: '+(n.cpv.length?n.cpv.join(', '):'not specified')));
      if(n.source_url){const a=el('a','View official TED notice');a.href=n.source_url;a.target='_blank';a.rel='noopener noreferrer';card.append(a);}
      out.append(card);
    }
  }catch(err){s.textContent='Error: '+err.message;}finally{b.disabled=false;}
});
</script></body></html>`;

const OPENAPI = {
  openapi: '3.0.3',
  info: { title: 'EU Tender Intelligence API', version: '0.3.0', description: 'Free, non-commercial prototype using TED Search API v3.' },
  paths: {
    '/api/health': { get: { summary: 'Service health check', responses: { '200': { description: 'OK' } } } },
    '/api/search': {
      get: {
        summary: 'Search TED notices by buyer country, CPV code and publication period',
        parameters: [
          { name: 'country', in: 'query', schema: { type: 'string', default: 'ROU', pattern: '^[A-Z]{3}$' } },
          { name: 'cpv', in: 'query', schema: { type: 'string', pattern: '^[0-9]{8}$' } },
          { name: 'days', in: 'query', schema: { type: 'integer', default: 30, minimum: 1, maximum: 365 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, minimum: 1, maximum: 25 } },
          { name: 'scope', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'ALL'], default: 'ACTIVE' } }
        ],
        responses: { '200': { description: 'Normalized procurement notices in JSON' }, '400': { description: 'Invalid parameters' }, '502': { description: 'TED is unavailable or returned an upstream error' } }
      }
    }
  }
};

// ---- MCP: experimental, dependency-free and no additional service costs ----
// Modern protocol version 2026-07-28 with backward compatibility for 2025 clients.
const MCP_VERSION = '2026-07-28';
const MCP_VERSIONS = [MCP_VERSION, '2025-11-25', '2025-06-18', '2025-03-26'];
const MCP_SERVER = { name: 'eu-tender-intelligence', version: '0.3.0' };
const MCP_TOOL = {
  name: 'search_tenders',
  title: 'Search EU public tenders',
  description: 'Search official European TED procurement notices by buyer country (3-letter ISO), optional 8-digit CPV, recent days, and limit. Results include TED source URLs. Read-only; ACTIVE does not guarantee the bid deadline is open.',
  inputSchema: {
    type: 'object', additionalProperties: false,
    properties: {
      country: { type: 'string', description: 'Buyer ISO-3 code, e.g. ROU, DEU, FRA. Defaults to ROU.', pattern: '^[A-Z]{3}$', default: 'ROU' },
      cpv: { type: 'string', description: 'Optional 8-digit CPV code, e.g. 72000000', pattern: '^[0-9]{8}$' },
      days: { type: 'integer', description: 'Lookback in days, from 1 to 365.', minimum: 1, maximum: 365, default: 30 },
      limit: { type: 'integer', description: 'Maximum number of results, 1 to 25.', minimum: 1, maximum: 25, default: 10 },
      scope: { type: 'string', enum: ['ACTIVE', 'ALL'], description: 'TED query scope. ACTIVE does not mean tender deadline is necessarily open.', default: 'ACTIVE' }
    }
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
};

// Deterministic matching is deliberately transparent: no paid model, no
// eligibility claims, and no claim to rank every notice in TED. We inspect
// up to 25 newest notices matching the selected country/CPV.
const MATCH_TOOL = {
  name: 'match_tenders',
  title: 'Match EU tenders to business keywords',
  description: 'Rank up to 25 recent TED notices using optional CPV and business keywords. Returns transparent rule-based scores, not eligibility decisions. Searches only a recent sample, not all TED notices. Free, read-only.',
  inputSchema: {
    type: 'object', additionalProperties: false,
    properties: {
      country: { type: 'string', pattern: '^[A-Z]{3}$', default: 'ROU', description: 'Buyer country ISO-3, e.g. ROU, DEU, FRA.' },
      cpv: { type: 'string', pattern: '^[0-9]{8}$', description: 'Optional 8-digit CPV filter. The TED query is restricted to this CPV.' },
      keywords: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'string', minLength: 2, maxLength: 64 }, description: 'Business services or products, e.g. ["cybersecurity", "network"]. Keywords are only used for local ranking, not inserted into TED queries.' },
      days: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
      scan_limit: { type: 'integer', minimum: 1, maximum: 25, default: 25, description: 'Maximum recent TED notices to inspect, 1–25.' },
      max_results: { type: 'integer', minimum: 1, maximum: 10, default: 5, description: 'Top scored notices to return.' },
      scope: { type: 'string', enum: ['ACTIVE', 'ALL'], default: 'ACTIVE' }
    },
    anyOf: [{ required: ['keywords'] }, { required: ['cpv'] }]
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
};
const MCP_TOOLS = [MCP_TOOL, MATCH_TOOL];

function rpc(id, property, value, status = 200) {
  return json({ jsonrpc: '2.0', id, [property]: value }, status);
}
function rpcError(id, code, message, status = 400, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return rpc(id, 'error', error, status);
}
function modernMeta() {
  return { 'io.modelcontextprotocol/serverInfo': MCP_SERVER };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Minimal aggregate-friendly telemetry. Never log tender search terms, IP, headers,
// request identifiers, user-agent, tokens or complete request/response bodies.
function usageEvent(channel, action, outcome, status) {
  console.log({
    event: 'eti_usage',
    channel,
    action,
    outcome,
    status
  });
}

async function runTenderTool(args, originalRequest, fetchTED) {
  if (!isObject(args)) return { isError: true, message: 'arguments must be a JSON object.' };
  const allowed = new Set(['country', 'cpv', 'days', 'limit', 'scope']);
  if (Object.keys(args).some(k => !allowed.has(k))) {
    return { isError: true, message: 'Unknown argument. Only country, cpv, days, limit, scope are allowed.' };
  }
  const url = new URL('/api/search', originalRequest.url);
  for (const [key, value] of Object.entries(args)) {
    if (value === null || typeof value === 'object' || typeof value === 'boolean') {
      return { isError: true, message: `Invalid argument: ${key}.` };
    }
    if (key === 'days' || key === 'limit') {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return { isError: true, message: `${key} must be an integer.` };
      }
    } else if (typeof value !== 'string') {
      return { isError: true, message: `${key} must be a string.` };
    }
    url.searchParams.set(key, String(value));
  }
  const dataResponse = await handleRequest(new Request(url), fetchTED);
  const data = await dataResponse.json();
  return { isError: !dataResponse.ok, data };
}

// Validate exact parameter names and types before calling the upstream API.
export function validateMatchArgs(args) {
  if (!isObject(args)) throw new Error('arguments must be a JSON object.');
  const allowed = new Set(['country', 'cpv', 'keywords', 'days', 'scan_limit', 'max_results', 'scope']);
  if (Object.keys(args).some(k => !allowed.has(k))) throw new Error('Unknown match_tenders argument.');
  const keywords = args.keywords === undefined ? [] : args.keywords;
  if (!Array.isArray(keywords) || keywords.length > 8 || keywords.some(
    k => typeof k !== 'string' || k.trim().length < 2 || k.length > 64
  )) throw new Error('keywords must contain 1–8 strings of 2–64 characters when supplied.');
  const cpv = args.cpv === undefined ? null : args.cpv;
  if (cpv !== null && (typeof cpv !== 'string' || !/^\d{8}$/.test(cpv))) {
    throw new Error('cpv must contain exactly 8 digits.');
  }
  if (keywords.length === 0 && !cpv) throw new Error('Provide keywords or cpv to match tenders.');
  const country = args.country === undefined ? 'ROU' : args.country;
  const scope = args.scope === undefined ? 'ACTIVE' : args.scope;
  if (typeof country !== 'string' || !/^[A-Z]{3}$/.test(country)) {
    throw new Error('country must be a three-letter uppercase ISO-3 code.');
  }
  if (typeof scope !== 'string' || !['ACTIVE', 'ALL'].includes(scope)) throw new Error('scope must be ACTIVE or ALL.');
  for (const key of ['days', 'scan_limit', 'max_results']) {
    if (args[key] !== undefined && (!Number.isSafeInteger(args[key]) || typeof args[key] !== 'number')) {
      throw new Error(key + ' must be an integer.');
    }
  }
  const days = args.days ?? 30;
  const scanLimit = args.scan_limit ?? 25;
  const maxResults = args.max_results ?? 5;
  if (days < 1 || days > 365) throw new Error('days must be between 1 and 365.');
  if (scanLimit < 1 || scanLimit > 25) throw new Error('scan_limit must be between 1 and 25.');
  if (maxResults < 1 || maxResults > 10) throw new Error('max_results must be between 1 and 10.');
  return {
    country, cpv, days, scope, scan_limit: scanLimit, max_results: maxResults,
    keywords: [...new Set(keywords.map(k => k.trim()).filter(Boolean))]
  };
}

function fold(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// A score is an explainable heuristic, NOT an assessed chance of winning a bid.
export function scoreNotice(notice, params) {
  const title = fold(notice.title);
  const buyer = fold(notice.buyer);
  const codes = Array.isArray(notice.cpv) ? notice.cpv : [];
  const reasons = [];
  const matchedKeywords = [];
  let score = 0;
  if (params.cpv) {
    if (codes.includes(params.cpv)) { score += 60; reasons.push('Exact CPV code match'); }
    else if (codes.some(c => c.startsWith(params.cpv.slice(0, 5)))) { score += 40; reasons.push('Related CPV category'); }
    else if (codes.some(c => c.startsWith(params.cpv.slice(0, 2)))) { score += 15; reasons.push('Same broad CPV division'); }
  }
  for (const keyword of params.keywords) {
    const needle = fold(keyword);
    if (title.includes(needle)) { score += 20; matchedKeywords.push(keyword); }
    else if (buyer.includes(needle)) { score += 5; matchedKeywords.push(keyword); }
  }
  if (matchedKeywords.length) reasons.push('Matched business keywords in notice title or buyer');
  return { score: Math.min(score, 100), matched_keywords: matchedKeywords, reasons };
}

async function runMatchTool(args, originalRequest, fetchTED) {
  let params;
  try { params = validateMatchArgs(args); }
  catch (err) { return { isError: true, message: err.message }; }
  const searchURL = new URL('/api/search', originalRequest.url);
  searchURL.searchParams.set('country', params.country);
  searchURL.searchParams.set('days', String(params.days));
  searchURL.searchParams.set('limit', String(params.scan_limit));
  searchURL.searchParams.set('scope', params.scope);
  if (params.cpv) searchURL.searchParams.set('cpv', params.cpv);
  const response = await handleRequest(new Request(searchURL), fetchTED);
  const data = await response.json();
  if (!response.ok) return { isError: true, data };
  const matches = data.results.map(n => ({ ...n, ...scoreNotice(n, params) }))
    .filter(n => n.score > 0)
    .sort((a, b) => b.score - a.score || String(b.publication_date || '').localeCompare(String(a.publication_date || '')))
    .slice(0, params.max_results);
  return { isError: false, data: {
    matches, returned_count: matches.length, inspected_count: data.count,
    total_from_ted: data.total_from_ted, filters: params,
    ranking_method: 'Rule-based CPV + keyword ranking, not AI or bid eligibility analysis.',
    coverage_note: 'Only the most recently published notices in one TED page were inspected. A zero-match response is not proof there are no suitable tenders.',
    deadline_note: 'TED ACTIVE status does not guarantee a bid deadline is still open. Verify source_url before bidding.',
    source: 'TED — Publications Office of the European Union'
  } };
}

export async function handleMcp(request, fetchTED = fetch) {
  if (request.method !== 'POST') {
    usageEvent('mcp', 'invalid_http_method', 'rejected', 405);
    return json({ error: 'MCP endpoint: use POST JSON-RPC. Open /mcp-info for details.' }, 405, { Allow: 'POST' });
  }
  // DNS rebinding protection: server-to-server clients may omit Origin.
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return rpcError(null, -32000, 'Origin is not allowed.', 403);
  if (!(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
    return rpcError(null, -32600, 'Content-Type must be application/json.', 415);
  }
  const accept = request.headers.get('accept') || '';
  if (!accept.includes('application/json') || !accept.includes('text/event-stream')) {
    return rpcError(null, -32600, 'Accept must include application/json and text/event-stream.', 406);
  }
  const declaredSize = Number(request.headers.get('content-length') || 0);
  if (declaredSize > 16384) return rpcError(null, -32600, 'Request body too large.', 413);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 16384) return rpcError(null, -32600, 'Request body too large.', 413);
    body = JSON.parse(raw);
  } catch (_) { return rpcError(null, -32700, 'Invalid JSON.'); }
  if (!isObject(body) || body.jsonrpc !== '2.0' || typeof body.method !== 'string' || (body.id !== undefined && typeof body.id !== 'string' && typeof body.id !== 'number')) {
    return rpcError(null, -32600, 'Invalid JSON-RPC request.');
  }

  const id = body.id ?? null;
  const version = request.headers.get('mcp-protocol-version');
  const modern = version === MCP_VERSION;
  if (modern) {
    const meta = body.params?._meta;
    if (!isObject(meta) || meta['io.modelcontextprotocol/protocolVersion'] !== MCP_VERSION || !isObject(meta['io.modelcontextprotocol/clientCapabilities'])) {
      return rpcError(id, -32602, 'Required MCP metadata is missing.', 400);
    }
    if (request.headers.get('mcp-method') !== body.method) {
      return rpcError(id, -32600, 'Mcp-Method does not match the request method.', 400);
    }
    if (body.method === 'tools/call' && request.headers.get('mcp-name') !== body.params?.name) {
      return rpcError(id, -32600, 'Mcp-Name does not match the tool name.', 400);
    }
  } else if (version && !MCP_VERSIONS.includes(version)) {
    return rpcError(id, -32022, 'Unsupported protocol version.', 400, { supported: MCP_VERSIONS, requested: version });
  }
  // Legacy notifications do not require a JSON-RPC response.
  if (body.id === undefined) {
    if (body.method === 'notifications/initialized') usageEvent('mcp', 'initialized_notification', 'ok', 202);
    return new Response(null, { status: 202 });
  }
  if (body.method === 'initialize' && !modern) {
    usageEvent('mcp', 'initialize', 'ok', 200);
    return rpc(id, 'result', {
      protocolVersion: MCP_VERSIONS.includes(body.params?.protocolVersion) && body.params.protocolVersion !== MCP_VERSION
        ? body.params.protocolVersion : '2025-11-25',
      capabilities: { tools: { listChanged: false } }, serverInfo: MCP_SERVER,
      instructions: 'Free tools for searching and ranking recent TED procurement notices. Scores do not determine bid eligibility. Verify original notices and deadlines.'
    });
  }
  if (body.method === 'server/discover' && modern) {
    usageEvent('mcp', 'server_discover', 'ok', 200);
    return rpc(id, 'result', {
      resultType: 'complete', supportedVersions: MCP_VERSIONS,
      capabilities: { tools: { listChanged: false } },
      instructions: 'Search and rank recent public TED procurement notices. Read-only operations; scoring is heuristic.',
      ttlMs: 3600000, cacheScope: 'public', _meta: modernMeta()
    });
  }
  if (body.method === 'ping') {
    usageEvent('mcp', 'ping', 'ok', 200);
    return rpc(id, 'result', modern ? { _meta: modernMeta() } : {});
  }
  if (body.method === 'tools/list') {
    usageEvent('mcp', 'tools_list', 'ok', 200);
    return rpc(id, 'result', modern
      ? { resultType: 'complete', tools: MCP_TOOLS, ttlMs: 3600000, cacheScope: 'public', _meta: modernMeta() }
      : { tools: MCP_TOOLS });
  }
  if (body.method === 'tools/call') {
    if (![MCP_TOOL.name, MATCH_TOOL.name].includes(body.params?.name)) {
      usageEvent('mcp', 'tools_call', 'unknown_tool', 400);
      return rpcError(id, -32602, 'Unknown tool: ' + String(body.params?.name), 400);
    }
    let outcome;
    try {
      outcome = body.params.name === MATCH_TOOL.name
        ? await runMatchTool(body.params.arguments || {}, request, fetchTED)
        : await runTenderTool(body.params.arguments || {}, request, fetchTED);
    } catch (_) { outcome = { isError: true, message: 'Internal error while processing TED notices.' }; }
    const payload = outcome.data || { error: outcome.message };
    usageEvent('mcp', body.params.name, outcome.isError ? 'error' : 'ok', 200);
    const result = {
      ...(modern ? { resultType: 'complete' } : {}),
      content: [{ type: 'text', text: JSON.stringify(payload) }],
      ...(outcome.isError ? { isError: true } : { structuredContent: payload }),
      ...(modern ? { _meta: modernMeta() } : {})
    };
    return rpc(id, 'result', result);
  }
  usageEvent('mcp', 'unknown_method', 'rejected', 404);
  return rpcError(id, -32601, 'Unknown MCP method.', 404);
}

export async function handleRequest(request, fetchTED = fetch) {
  const url = new URL(request.url);
  if (url.pathname === '/mcp') return handleMcp(request, fetchTED);
  if (request.method !== 'GET') return json({ error: 'Method not allowed. Use GET.' }, 405, { allow: 'GET' });
  if (url.pathname === '/') {
    return new Response(PAGE, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'"
      }
    });
  }
  if (url.pathname === '/mcp-info') return json({
    name: 'EU Tender Intelligence MCP', version: '0.3.0',
    endpoint: new URL('/mcp', request.url).href,
    transport: 'Streamable HTTP POST (JSON-RPC)',
    supported_protocol_versions: MCP_VERSIONS,
    tools: MCP_TOOLS.map(tool => tool.name),
    note: 'MCP endpoint: use POST JSON-RPC. For browser-friendly information, open /mcp-info instead of /mcp.'
  });
  if (url.pathname === '/openapi.json') return json(OPENAPI);
  if (url.pathname === '/api/health') return json({ status: 'ok', version: '0.3.0', source: 'TED Search API v3' });
  if (url.pathname !== '/api/search') return json({ error: 'Route not found.' }, 404);

  let params;
  try { params = parseParams(url); }
  catch (error) { return json({ error: error.message }, 400); }

  const tedRequest = buildTedRequest(params);
  let response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      response = await fetchTED(TED_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(tedRequest),
        signal: controller.signal
      });
    } finally { clearTimeout(timeout); }
  } catch (_) {
    return json({ error: 'TED did not respond. Please try again later.' }, 502);
  }
  if (!response.ok) {
    return json({ error: `TED returned HTTP ${response.status}. Check your filters or try again later.` }, 502);
  }
  let raw;
  try { raw = await response.json(); }
  catch (_) { return json({ error: 'TED returned an invalid response.' }, 502); }
  if (!raw || !Array.isArray(raw.notices)) {
    return json({ error: 'The TED response format has changed.' }, 502);
  }
  const results = raw.notices.map(normalizeNotice);
  return json({
    count: results.length,
    total_from_ted: raw.totalNoticeCount ?? null,
    filters: params,
    ted_query: tedRequest.query,
    source: 'TED — Publications Office of the European Union',
    caveat: 'ACTIVE status does not guarantee the tender is still open for bids.',
    results
  });
}

export default {
  async fetch(request) {
    const response = await handleRequest(request);
    if (new URL(request.url).pathname === '/api/search') {
      usageEvent('rest', 'search_tenders', response.ok ? 'ok' : 'error', response.status);
    }
    return response;
  }
};
