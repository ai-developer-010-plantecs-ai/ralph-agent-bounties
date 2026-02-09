import { serve } from "bun";
import { getGasRoutes, GasInputSchema } from "./lib/gas-api";

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

console.log(`Starting GasRoute Oracle agent server on port ${port}..`);

serve({
  port,
  fetch: async (req) => {
    const url = new URL(req.url);
    
    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // List entrypoints
    if (url.pathname === '/entrypoints' && req.method === 'GET') {
      return new Response(JSON.stringify({
        entrypoints: ['echo', 'gas-routes']
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Echo entrypoint
    if (url.pathname === '/entrypoints/echo/invoke' && req.method === 'POST') {
      try {
        const { input } = await req.json();
        return new Response(JSON.stringify({
          output: { text: input.text },
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid input' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Gas routes entrypoint
    if (url.pathname === '/entrypoints/gas-routes/invoke' && req.method === 'POST') {
      try {
        const { input } = await req.json();
        const parsed = GasInputSchema.parse(input);
        const routes = await getGasRoutes(
          parsed.chain_set,
          parsed.calldata_size_bytes,
          parsed.gas_units_est
        );
        
        return new Response(JSON.stringify({
          output: {
            recommended_chain: routes[0]?.chain,
            routes,
          },
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Agent manifest
    if (url.pathname === '/.well-known/agent.json') {
      return new Response(JSON.stringify({
        name: process.env.AGENT_NAME ?? 'gasroute-oracle',
        version: process.env.AGENT_VERSION ?? '0.1.0',
        description: process.env.AGENT_DESCRIPTION ?? 'Choose cheapest chain and timing hint for a swap or contract call',
        entrypoints: ['echo', 'gas-routes'],
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('Not Found', { status: 404 });
  },
});

console.log(`GasRoute Oracle agent running on http://localhost:${port}`);
