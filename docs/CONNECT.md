# Connect and test the MCP tool

## Remote MCP configuration

- **Transport:** Streamable HTTP
- **URL:** `https://eu-tender-intelligence.balkanpilot.workers.dev/mcp`
- **Tool:** `search_tenders`
- **Authentication:** none (currently)

Configure these values in a client that supports remote Streamable HTTP MCP endpoints. Client-specific configuration steps may vary.

## Windows PowerShell smoke test

These three requests were used to verify the deployed v0.2.0 service. They use the supported `2025-11-25` protocol version.

```powershell
$url = 'https://eu-tender-intelligence.balkanpilot.workers.dev/mcp'
$headers = @{
  Accept = 'application/json, text/event-stream'
  'MCP-Protocol-Version' = '2025-11-25'
}

$init = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"smoke-test","version":"1.0.0"}}}'
Invoke-RestMethod -Uri $url -Method Post -Headers $headers -ContentType 'application/json' -Body $init | ConvertTo-Json -Depth 8

$list = '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
Invoke-RestMethod -Uri $url -Method Post -Headers $headers -ContentType 'application/json' -Body $list | ConvertTo-Json -Depth 8

$call = '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_tenders","arguments":{"country":"ROU","days":7,"limit":2}}}'
Invoke-RestMethod -Uri $url -Method Post -Headers $headers -ContentType 'application/json' -Body $call | ConvertTo-Json -Depth 8
```

Expected: a protocol initialization result, a tool list including `search_tenders`, and a tool response containing structured tender data (or an upstream TED error if TED is unavailable).

## HTTP REST quick check

Open these in a browser:

- [Service health](https://eu-tender-intelligence.balkanpilot.workers.dev/api/health)
- [Search two Romanian procurement notices](https://eu-tender-intelligence.balkanpilot.workers.dev/api/search?country=ROU&days=7&limit=2)

## Usage notes

- This MCP server currently implements a small subset of MCP features. The tested legacy HTTP flow does not require a persistent server-side session.
- For a quick human-friendly description, visit `/mcp-info`.
- Tender deadlines may be missing; check the source TED notice before relying on the output.
- Do not include API tokens or passwords in GitHub files, issues, or examples.
