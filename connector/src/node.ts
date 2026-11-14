import { createServer, type Server } from 'node:http';
import { handleMcpRequest, type ConnectorDeps } from './server';

/** Local/dev adapter: serves the web-standard handler on a Node HTTP port. */
export const serveNode = (deps: ConnectorDeps, port = 8787): Promise<Server> =>
  new Promise(resolve => {
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const url = `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`;
      if (!url.includes('/mcp')) { res.writeHead(404).end('not found'); return; }
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      const body = chunks.length && req.method !== 'GET' && req.method !== 'HEAD' ? Buffer.concat(chunks) : undefined;
      const response = await handleMcpRequest(new Request(url, { method: req.method, headers, body }), deps);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(await response.arrayBuffer()));
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
