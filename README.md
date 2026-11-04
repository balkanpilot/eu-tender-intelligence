# EU Tender Intelligence

**Free, read-only public procurement search for AI agents and developers.**

[Live web demo](https://eu-tender-intelligence.balkanpilot.workers.dev/) · [REST API](https://eu-tender-intelligence.balkanpilot.workers.dev/openapi.json) · [MCP metadata](https://eu-tender-intelligence.balkanpilot.workers.dev/mcp-info) · [MCP Registry](https://registry.modelcontextprotocol.io/)

This experimental Cloudflare Worker searches European Union public procurement notices using the official [TED Search API](https://docs.ted.europa.eu/api/latest/search.html). It provides a browser UI, a JSON REST API, and a remote MCP endpoint.

**Current version:** 0.2.0. Published in the official MCP Registry as `io.github.balkanpilot/eu-tender-intelligence`.

## Quick access

| Purpose | URL |
|---|---|
| Browse tenders | `https://eu-tender-intelligence.balkanpilot.workers.dev/` |
| Check service health | `https://eu-tender-intelligence.balkanpilot.workers.dev/api/health` |
| Search by REST | `https://eu-tender-intelligence.balkanpilot.workers.dev/api/search?country=ROU&days=7&limit=2` |
| OpenAPI | `https://eu-tender-intelligence.balkanpilot.workers.dev/openapi.json` |
| MCP details | `https://eu-tender-intelligence.balkanpilot.workers.dev/mcp-info` |
| Remote MCP endpoint | `https://eu-tender-intelligence.balkanpilot.workers.dev/mcp` |

## What it does

- Search procurement notices by **buyer country** (ISO-3), optional **8-digit CPV code**, recent **publication period** and result limit.
- Return a normalized title, buyer, notice number, publication date, reported deadline, CPV codes, and official TED notice link when provided.
- Let compatible AI clients discover the `search_tenders` tool and request search results in JSON.
- Keep all operations **read-only**; no account, API key, or payment currently required.

Example REST request:

```text
GET https://eu-tender-intelligence.balkanpilot.workers.dev/api/search?country=ROU&days=7&limit=2
```

Optional query parameters: `country` (default `ROU`), `cpv` (8 digits), `days` (1–365), `limit` (1–25), `scope` (`ACTIVE` or `ALL`).

> **Important:** An `ACTIVE` result does **not** guarantee that a tender is still open for bids. Always check the original notice for eligibility, scope, and submission deadlines. TED is the official source of data; this project is an independent prototype, not an EU institution service.

## Connect an MCP client

**Streamable HTTP endpoint:**

```text
https://eu-tender-intelligence.balkanpilot.workers.dev/mcp
```

**Tool:** `search_tenders`

Example tool arguments:

```json
{
  "country": "ROU",
  "days": 7,
  "limit": 2,
  "scope": "ACTIVE"
}
```

Use a compatible MCP client and configure it with the remote HTTP endpoint above. `GET /mcp` is not a browser demo; the current implementation expects JSON-RPC over `POST`. You can inspect metadata at `/mcp-info` instead.

For an end-to-end PowerShell example of the **tested legacy MCP version** (`2025-11-25`), see [docs/CONNECT.md](docs/CONNECT.md).

## Project structure

```text
src/index.js       Cloudflare Worker, web UI, REST and MCP endpoints
server.json        Official MCP Registry metadata (version 0.2.0)
wrangler.toml      Worker deployment configuration
package.json       Development and test scripts
tests/             Automated tests with mocked TED responses
docs/CONNECT.md    Connection and manual testing examples
```

## Run tests locally

Node.js 22 or later:

```bash
npm test
```

The automated tests mock TED. The publicly deployed endpoint was separately tested with an MCP client using `initialize`, `tools/list`, and `tools/call`. Other clients and protocol versions have not been comprehensively verified.

## Deploy your own copy (optional)

1. Install Node.js 22+ and set up Cloudflare Wrangler authentication.
2. Run `npm install` in this repository.
3. Review `wrangler.toml` and **change the Worker name** if you do not own the existing deployment.
4. Run `npm run deploy` to deploy to your Cloudflare account.

The original live deployment was created via Cloudflare's web editor. **Uploading files to GitHub does not automatically update the running Worker.**

## Limitations and costs

- Beta/experimental. Not a certified MCP implementation and not guaranteed to work with every agent.
- Currently **no authentication, per-client analytics, monetization, or advanced abuse protection**. Avoid large-scale traffic until appropriate safeguards are added.
- The free Cloudflare Workers tier and the TED API are subject to their respective terms and limits.
- A visit, a registry listing, or an MCP initialization does **not** prove a paid customer or even a human user.
- No license has yet been granted for reuse of this repository's source code; contact the repository owner for licensing requests.

## Sources

- [TED Search API documentation](https://docs.ted.europa.eu/api/latest/search.html)
- [Model Context Protocol documentation](https://modelcontextprotocol.io/)
- [Official MCP Registry](https://registry.modelcontextprotocol.io/)
