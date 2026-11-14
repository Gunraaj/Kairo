# Kairo MCP connector (prototype)

A remote MCP server that lets ChatGPT, Claude or Gemini read a student's Kairo plan and add tasks.
It reuses the app's own planning and validation code (`../utils`), so the numbers match the app.

Tools: `get_today`, `get_study_profile`, `list_projects` (read-only) and `add_plan`, `add_subtasks`, `set_deadline` (writes, non-destructive). Every tool carries MCP safety annotations.

```bash
cd connector && npm install && npm test   # 7 tests using the official MCP client, incl. a real HTTP socket
```

## What is proven here
Protocol (initialize, instructions, tools/list, tools/call over Streamable HTTP), tool schemas and annotations, reads and writes, validation errors, hostile text staying inert, per-user isolation, 401 with an OAuth `resource_metadata` challenge.

## What is NOT proven (needs a public HTTPS URL and a real account)
- Acceptance by ChatGPT, Claude or Gemini themselves.
- OAuth 2.1 with PKCE: Claude registers via Dynamic Client Registration and calls back to `https://claude.ai/api/mcp/auth_callback`. Supabase Auth can act as the authorization server; the wiring is not written yet (`authenticate` is a stub in tests).
- A real `KairoStore`. The app keeps data in the browser, so a connector only works for a "Connected" user whose projects and sessions are stored server-side (SAAS_PLAN step 7). `memoryStore` is for tests.

## Deploy sketch (free)
`handleMcpRequest(request, deps)` takes and returns web-standard `Request`/`Response`, so it runs unchanged in a Cloudflare Worker. `src/node.ts` serves it on a local port for development.
