/**
 * EU Tender Intelligence — prototip gratuit v0.2 cu MCP.
 * Sursa: Publications Office of the EU / TED Search API v3.
 * Fără chei API, fără plăți și fără conturi de utilizator. MCP gratuit, doar citire.
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

function pickText(value, preferred = ['ron', 'eng', 'fra', 'deu']) {
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
  if (!/^\d+$/.test(String(value))) throw new Error(`${name} trebuie să fie un număr întreg.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(`${name} trebuie să fie între ${min} și ${max}.`);
  }
  return number;
}

export function parseParams(url) {
  const country = (url.searchParams.get('country') || DEFAULTS.country).toUpperCase();
  const cpv = url.searchParams.get('cpv') || null;
  const days = positiveInt(url.searchParams.get('days') || DEFAULTS.days, 'days', 1, 365);
  const limit = positiveInt(url.searchParams.get('limit') || DEFAULTS.limit, 'limit', 1, 25);
  const scope = (url.searchParams.get('scope') || DEFAULTS.scope).toUpperCase();
  if (!/^[A-Z]{3}$/.test(country)) throw new Error('country trebuie să fie un cod ISO-3, ex. ROU.');
  if (cpv !== null && !/^\d{8}$/.test(cpv)) throw new Error('cpv trebuie să conțină exact 8 cifre.');
  if (!['ACTIVE', 'ALL'].includes(scope)) throw new Error('scope trebuie să fie ACTIVE sau ALL.');
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
<html lang="ro">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>EU Tender Intelligence · Demo gratuit</title>
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
  <header><h1>EU Tender Intelligence</h1><p>Prototip v0.2 — găsește anunțuri europene de achiziții publice din sursa oficială TED. Gratuit, fără cont.</p></header>
  <section class="panel">
    <form id="form">
      <div><label for="country">Țara cumpărătorului</label><select id="country" name="country"><option value="ROU">România</option><option value="DEU">Germania</option><option value="FRA">Franța</option><option value="ITA">Italia</option><option value="ESP">Spania</option><option value="POL">Polonia</option><option value="HUN">Ungaria</option></select></div>
      <div><label for="days">Ultimele zile</label><select id="days" name="days"><option value="7">7</option><option value="30" selected>30</option><option value="90">90</option><option value="365">365</option></select></div>
      <div><label for="cpv">CPV (opțional)</label><input id="cpv" name="cpv" placeholder="ex. 72000000" pattern="[0-9]{8}" maxlength="8"></div>
      <div><label for="limit">Rezultate</label><select id="limit" name="limit"><option>5</option><option selected>10</option><option>20</option></select></div>
      <div class="wide"><button id="search" type="submit">Caută în TED</button></div>
    </form>
    <p class="hint">„ACTIVE” în TED nu garantează că termenul de depunere a ofertelor nu a expirat. Verifică întotdeauna anunțul oficial.</p>
  </section>
  <p id="status" role="status">Alege filtrele și apasă „Caută în TED”.</p><section id="results"></section>
  <p class="hint">Acces API pentru programe: <a href="/mcp-info">/mcp-info</a> · <a href="/openapi.json">/openapi.json</a> · <a href="/api/health">/api/health</a> · Date: <a href="https://ted.europa.eu/">TED — Publications Office of the EU</a>.</p>
</main>
<script>
const f=document.getElementById('form'),b=document.getElementById('search'),s=document.getElementById('status'),out=document.getElementById('results');
function el(tag,text,cls){const x=document.createElement(tag);if(text)x.textContent=text;if(cls)x.className=cls;return x;}
f.addEventListener('submit',async e=>{
  e.preventDefault();b.disabled=true;s.textContent='Se caută în TED...';out.replaceChildren();
  const p=new URLSearchParams(new FormData(f));p.set('scope','ACTIVE');
  try{
    const r=await fetch('/api/search?'+p.toString());const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Eroare necunoscută');
    s.textContent='Rezultate afișate: '+d.count+' · Totalul raportat de TED: '+(d.total_from_ted??'necunoscut');
    if(!d.results.length)out.append(el('p','Niciun anunț găsit. Încearcă o perioadă mai lungă sau fără CPV.'));
    for(const n of d.results){
      const card=el('article',null,'result');card.append(el('h2',n.title||'Anunț fără titlu'));
      card.append(el('p','Cumpărător: '+(n.buyer||'Nespecificat')));
      card.append(el('p','Publicat: '+(n.publication_date||'—')+' · Termen: '+(n.deadline_date||'neprecizat')));
      card.append(el('p','CPV: '+(n.cpv.length?n.cpv.join(', '):'neprecizat')));
      if(n.source_url){const a=el('a','Vezi anunțul oficial TED');a.href=n.source_url;a.target='_blank';a.rel='noopener noreferrer';card.append(a);}
      out.append(card);
    }
  }catch(err){s.textContent='Eroare: '+err.message;}finally{b.disabled=false;}
});
</script></body></html>`;

const OPENAPI = {
  openapi: '3.0.3',
  info: { title: 'EU Tender Intelligence API', version: '0.2.0', description: 'Prototip gratuit, necomercial, bazat pe TED Search API v3.' },
  paths: {
    '/api/health': { get: { summary: 'Verificare serviciu', responses: { '200': { description: 'OK' } } } },
    '/api/search': {
      get: {
        summary: 'Caută anunțuri TED după țara cumpărătorului, CPV și perioada publicării',
        parameters: [
          { name: 'country', in: 'query', schema: { type: 'string', default: 'ROU', pattern: '^[A-Z]{3}$' } },
          { name: 'cpv', in: 'query', schema: { type: 'string', pattern: '^[0-9]{8}$' } },
          { name: 'days', in: 'query', schema: { type: 'integer', default: 30, minimum: 1, maximum: 365 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, minimum: 1, maximum: 25 } },
          { name: 'scope', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'ALL'], default: 'ACTIVE' } }
        ],
        responses: { '200': { description: 'Anunțuri normalizate în JSON' }, '400': { description: 'Parametri invalizi' }, '502': { description: 'TED indisponibil sau eroare amonte' } }
      }
    }
  }
};

// ---- MCP: integrare experimentală, fără dependențe și fără costuri ----
// Versiune modernă 2026-07-28 + compatibilitate cu clienții legacy 2025.
const MCP_VERSION = '2026-07-28';
const MCP_VERSIONS = [MCP_VERSION, '2025-11-25', '2025-06-18', '2025-03-26'];
const MCP_SERVER = { name: 'eu-tender-intelligence', version: '0.2.0' };
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

async function runTenderTool(args, originalRequest, fetchTED) {
  if (!isObject(args)) return { isError: true, message: 'arguments trebuie să fie un obiect JSON.' };
  const allowed = new Set(['country', 'cpv', 'days', 'limit', 'scope']);
  if (Object.keys(args).some(k => !allowed.has(k))) {
    return { isError: true, message: 'Argument necunoscut. Sunt permise doar country, cpv, days, limit, scope.' };
  }
  const url = new URL('/api/search', originalRequest.url);
  for (const [key, value] of Object.entries(args)) {
    if (value === null || typeof value === 'object' || typeof value === 'boolean') {
      return { isError: true, message: `Argument invalid: ${key}.` };
    }
    if (key === 'days' || key === 'limit') {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return { isError: true, message: `${key} trebuie să fie un număr întreg.` };
      }
    } else if (typeof value !== 'string') {
      return { isError: true, message: `${key} trebuie să fie un text.` };
    }
    url.searchParams.set(key, String(value));
  }
  const dataResponse = await handleRequest(new Request(url), fetchTED);
  const data = await dataResponse.json();
  return { isError: !dataResponse.ok, data };
}

export async function handleMcp(request, fetchTED = fetch) {
  if (request.method !== 'POST') {
    return json({ error: 'Endpoint MCP: folosește POST JSON-RPC. Pentru informații, deschide /mcp-info.' }, 405, { Allow: 'POST' });
  }
  // Protecție DNS rebinding: clienții server-to-server pot să nu trimită Origin.
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return rpcError(null, -32000, 'Origin nepermis.', 403);
  if (!(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
    return rpcError(null, -32600, 'Content-Type trebuie să fie application/json.', 415);
  }
  const accept = request.headers.get('accept') || '';
  if (!accept.includes('application/json') || !accept.includes('text/event-stream')) {
    return rpcError(null, -32600, 'Accept trebuie să includă application/json și text/event-stream.', 406);
  }
  const declaredSize = Number(request.headers.get('content-length') || 0);
  if (declaredSize > 16384) return rpcError(null, -32600, 'Cerere prea mare.', 413);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 16384) return rpcError(null, -32600, 'Cerere prea mare.', 413);
    body = JSON.parse(raw);
  } catch (_) { return rpcError(null, -32700, 'JSON invalid.'); }
  if (!isObject(body) || body.jsonrpc !== '2.0' || typeof body.method !== 'string' || (body.id !== undefined && typeof body.id !== 'string' && typeof body.id !== 'number')) {
    return rpcError(null, -32600, 'Cerere JSON-RPC invalidă.');
  }

  const id = body.id ?? null;
  const version = request.headers.get('mcp-protocol-version');
  const modern = version === MCP_VERSION;
  if (modern) {
    const meta = body.params?._meta;
    if (!isObject(meta) || meta['io.modelcontextprotocol/protocolVersion'] !== MCP_VERSION || !isObject(meta['io.modelcontextprotocol/clientCapabilities'])) {
      return rpcError(id, -32602, 'Lipsesc metadatele MCP obligatorii.', 400);
    }
    if (request.headers.get('mcp-method') !== body.method) {
      return rpcError(id, -32600, 'Mcp-Method nu corespunde metodei.', 400);
    }
    if (body.method === 'tools/call' && request.headers.get('mcp-name') !== body.params?.name) {
      return rpcError(id, -32600, 'Mcp-Name nu corespunde numelui instrumentului.', 400);
    }
  } else if (version && !MCP_VERSIONS.includes(version)) {
    return rpcError(id, -32022, 'Unsupported protocol version.', 400, { supported: MCP_VERSIONS, requested: version });
  }
  // Notificările legacy nu necesită răspuns JSON-RPC.
  if (body.id === undefined) return new Response(null, { status: 202 });
  if (body.method === 'initialize' && !modern) {
    return rpc(id, 'result', {
      protocolVersion: MCP_VERSIONS.includes(body.params?.protocolVersion) && body.params.protocolVersion !== MCP_VERSION
        ? body.params.protocolVersion : '2025-11-25',
      capabilities: { tools: { listChanged: false } }, serverInfo: MCP_SERVER,
      instructions: 'Instrument gratuit pentru a căuta anunțuri TED. Verifică termenele pe site-ul oficial.'
    });
  }
  if (body.method === 'server/discover' && modern) {
    return rpc(id, 'result', {
      resultType: 'complete', supportedVersions: MCP_VERSIONS,
      capabilities: { tools: { listChanged: false } },
      instructions: 'Caută anunțuri publice TED, fără operațiuni de scriere.',
      ttlMs: 3600000, cacheScope: 'public', _meta: modernMeta()
    });
  }
  if (body.method === 'ping') {
    return rpc(id, 'result', modern ? { _meta: modernMeta() } : {});
  }
  if (body.method === 'tools/list') {
    return rpc(id, 'result', modern
      ? { resultType: 'complete', tools: [MCP_TOOL], ttlMs: 3600000, cacheScope: 'public', _meta: modernMeta() }
      : { tools: [MCP_TOOL] });
  }
  if (body.method === 'tools/call') {
    if (body.params?.name !== MCP_TOOL.name) {
      return rpcError(id, -32602, 'Instrument necunoscut: ' + String(body.params?.name), 400);
    }
    let outcome;
    try { outcome = await runTenderTool(body.params.arguments || {}, request, fetchTED); }
    catch (_) { outcome = { isError: true, message: 'Eroare internă la căutarea în TED.' }; }
    const payload = outcome.data || { error: outcome.message };
    const result = {
      ...(modern ? { resultType: 'complete' } : {}),
      content: [{ type: 'text', text: JSON.stringify(payload) }],
      ...(outcome.isError ? { isError: true } : { structuredContent: payload }),
      ...(modern ? { _meta: modernMeta() } : {})
    };
    return rpc(id, 'result', result);
  }
  return rpcError(id, -32601, 'Metodă MCP necunoscută.', 404);
}

export async function handleRequest(request, fetchTED = fetch) {
  const url = new URL(request.url);
  if (url.pathname === '/mcp') return handleMcp(request, fetchTED);
  if (request.method !== 'GET') return json({ error: 'Metodă neacceptată. Folosește GET.' }, 405, { allow: 'GET' });
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
    name: 'EU Tender Intelligence MCP', version: '0.2.0',
    endpoint: new URL('/mcp', request.url).href,
    transport: 'Streamable HTTP POST (JSON-RPC)',
    supported_protocol_versions: MCP_VERSIONS,
    tools: [MCP_TOOL.name],
    note: 'Endpoint MCP: POST JSON-RPC. În browser deschide /mcp-info, nu /mcp.'
  });
  if (url.pathname === '/openapi.json') return json(OPENAPI);
  if (url.pathname === '/api/health') return json({ status: 'ok', version: '0.2.0', source: 'TED Search API v3' });
  if (url.pathname !== '/api/search') return json({ error: 'Ruta nu există.' }, 404);

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
    return json({ error: 'TED nu a răspuns. Încearcă din nou mai târziu.' }, 502);
  }
  if (!response.ok) {
    return json({ error: `TED a returnat codul HTTP ${response.status}. Verifică filtrele sau încearcă mai târziu.` }, 502);
  }
  let raw;
  try { raw = await response.json(); }
  catch (_) { return json({ error: 'TED a returnat un răspuns invalid.' }, 502); }
  if (!raw || !Array.isArray(raw.notices)) {
    return json({ error: 'Formatul răspunsului TED s-a schimbat.' }, 502);
  }
  const results = raw.notices.map(normalizeNotice);
  return json({
    count: results.length,
    total_from_ted: raw.totalNoticeCount ?? null,
    filters: params,
    ted_query: tedRequest.query,
    source: 'TED — Publications Office of the European Union',
    caveat: 'Statusul ACTIVE nu confirmă automat că termenul de ofertare este deschis.',
    results
  });
}

export default {
  async fetch(request) { return handleRequest(request); }
};
