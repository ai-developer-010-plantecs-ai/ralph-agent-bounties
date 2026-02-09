import { createAgentApp } from '@lucid-dreams/agent-kit';
import { Hono } from 'hono';

console.log('[STARTUP] ===== BRIDGE ROUTE PINGER =====');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'https://facilitator.cdp.coinbase.com';
const WALLET_ADDRESS = process.env.ADDRESS || '0x01D11F7e1a46AbFC6092d7be484895D2d505095c';
const NETWORK = process.env.NETWORK || 'base';

const TOKEN_ADDRESSES: Record<string, Record<number, string>> = {
  USDC: {
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  },
  USDT: {
    1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    10: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  },
};

interface BridgeRoute {
  bridge_name: string;
  route_id: string;
  from_chain: number;
  to_chain: number;
  token_in: string;
  token_out: string;
  amount_in: string;
  amount_out: string;
  fee_usd: string;
  eta_minutes: number;
  requirements: string[];
  steps: string[];
  source: string;
}

function resolveTokenAddress(token: string, chainId: number): string {
  if (token.startsWith('0x') && token.length === 42) return token;
  const tokenUpper = token.toUpperCase();
  return TOKEN_ADDRESSES[tokenUpper]?.[chainId] || token;
}

async function fetchSocketRoutes(fromToken: string, amount: string, fromChain: number, toChain: number): Promise<BridgeRoute[]> {
  try {
    const url = `https://api.socket.tech/v2/quote?fromChainId=${fromChain}&toChainId=${toChain}&fromTokenAddress=${fromToken}&toTokenAddress=${fromToken}&fromAmount=${amount}&userAddress=0x0000000000000000000000000000000000000000&sort=output&singleTxOnly=true`;
    const response = await fetch(url, { headers: { 'API-KEY': process.env.SOCKET_API_KEY || '' } });
    if (!response.ok) return [];
    const data = await response.json();

    return (data.result?.routes || []).slice(0, 3).map((route: any, idx: number) => ({
      bridge_name: route.usedBridgeNames?.[0] || 'Socket',
      route_id: `socket_${idx}`,
      from_chain: fromChain,
      to_chain: toChain,
      token_in: fromToken,
      token_out: fromToken,
      amount_in: amount,
      amount_out: route.toAmount || '0',
      fee_usd: (parseFloat(route.totalGasFeesInUsd || '0')).toFixed(2),
      eta_minutes: Math.ceil((route.serviceTime || 300) / 60),
      requirements: [],
      steps: route.userTxs?.map((tx: any) => tx.protocol?.displayName || 'Transfer') || [],
      source: 'socket_api',
    }));
  } catch (error) {
    console.error('[SOCKET] Error:', error);
    return [];
  }
}

async function fetchLifiRoutes(fromToken: string, toToken: string, amount: string, fromChain: number, toChain: number): Promise<BridgeRoute[]> {
  try {
    const url = 'https://li.quest/v1/quote';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromChain,
        toChain,
        fromToken,
        toToken,
        fromAmount: amount,
        fromAddress: '0x0000000000000000000000000000000000000000',
      }),
    });
    if (!response.ok) return [];
    const data = await response.json();

    return [{
      bridge_name: data.toolDetails?.name || 'LI.FI',
      route_id: 'lifi_0',
      from_chain: fromChain,
      to_chain: toChain,
      token_in: fromToken,
      token_out: toToken,
      amount_in: amount,
      amount_out: data.estimate?.toAmount || '0',
      fee_usd: (parseFloat(data.estimate?.gasCosts?.[0]?.amountUSD || '0')).toFixed(2),
      eta_minutes: Math.ceil((data.estimate?.executionDuration || 300) / 60),
      requirements: [],
      steps: data.steps?.map((step: any) => step.tool) || [],
      source: 'lifi_api',
    }];
  } catch (error) {
    console.error('[LIFI] Error:', error);
    return [];
  }
}

async function getBridgeRoutes(token: string, amount: string, fromChain: number, toChain: number): Promise<BridgeRoute[]> {
  const fromToken = resolveTokenAddress(token, fromChain);
  const toToken = resolveTokenAddress(token, toChain);

  const [socketRoutes, lifiRoutes] = await Promise.allSettled([
    fetchSocketRoutes(fromToken, amount, fromChain, toChain),
    fetchLifiRoutes(fromToken, toToken, amount, fromChain, toChain),
  ]);

  const allRoutes: BridgeRoute[] = [];
  if (socketRoutes.status === 'fulfilled') allRoutes.push(...socketRoutes.value);
  if (lifiRoutes.status === 'fulfilled') allRoutes.push(...lifiRoutes.value);

  return allRoutes;
}

const app = createAgentApp({
  name: 'Bridge Route Pinger',
  description: 'List viable bridge routes and live fee/time quotes for token transfers',
  version: '1.0.0',
  paymentsConfig: {
    facilitatorUrl: FACILITATOR_URL,
    address: WALLET_ADDRESS as `0x${string}`,
    network: NETWORK,
    defaultPrice: '$0.08',
  },
});

const honoApp = app.app;

honoApp.get('/health', (c) => c.json({ status: 'ok', service: 'Bridge Route Pinger', version: '1.0.0' }));

honoApp.get('/og-image.png', (c) => {
  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#16213e"/>
  <text x="600" y="280" font-family="Arial" font-size="60" fill="#4db6ac" text-anchor="middle" font-weight="bold">Bridge Route Pinger</text>
  <text x="600" y="350" font-family="Arial" font-size="32" fill="#80deea" text-anchor="middle">Cross-Chain Bridge Aggregator</text>
  <text x="600" y="420" font-family="Arial" font-size="24" fill="#b2dfdb" text-anchor="middle">Socket · LI.FI · Multi-Chain</text>
</svg>`;
  c.header('Content-Type', 'image/svg+xml');
  return c.body(svg);
});

app.addEntrypoint({
  key: 'bridge-route-pinger',
  name: 'Bridge Route Pinger',
  description: 'Get viable bridge routes and live fee/time quotes for token transfers',
  price: '$0.08',
  outputSchema: {
    input: {
      type: 'http',
      method: 'POST',
      discoverable: true,
      bodyType: 'json',
      bodyFields: {
        token: { type: 'string', required: true, description: 'Token symbol or address' },
        amount: { type: 'string', required: true, description: 'Amount in token decimals' },
        from_chain: { type: 'integer', required: true, description: 'Source chain ID' },
        to_chain: { type: 'integer', required: true, description: 'Destination chain ID' },
      },
    },
    output: {
      type: 'object',
      required: ['routes', 'total_routes', 'timestamp'],
      properties: {
        routes: { type: 'array', description: 'Available bridge routes' },
        total_routes: { type: 'integer' },
        best_route: { type: ['string', 'null'] },
        timestamp: { type: 'string' },
      },
    },
  } as any,
  handler: async (ctx) => {
    const { token, amount, from_chain, to_chain } = ctx.input as any;
    const routes = await getBridgeRoutes(token, amount, from_chain, to_chain);

    let bestRoute = null;
    if (routes.length > 0) {
      const sorted = routes.sort((a, b) => parseFloat(a.fee_usd) - parseFloat(b.fee_usd));
      bestRoute = sorted[0].route_id;
    }

    return {
      routes,
      total_routes: routes.length,
      best_route: bestRoute,
      timestamp: new Date().toISOString(),
    };
  },
});

const wrapperApp = new Hono();

wrapperApp.get('/favicon.ico', (c) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#4db6ac"/><text y=".9em" x="50%" text-anchor="middle" font-size="90">🌉</text></svg>`;
  c.header('Content-Type', 'image/svg+xml');
  return c.body(svg);
});

wrapperApp.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Bridge Route Pinger - x402 Agent</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.ico">
  <meta property="og:title" content="Bridge Route Pinger - x402 Agent">
  <meta property="og:description" content="List viable bridge routes and live fee/time quotes for token transfers">
  <meta property="og:image" content="https://bridge-route-pinger-production-1647.up.railway.app/og-image.png">
  <style>body{font-family:system-ui;max-width:1200px;margin:40px auto;padding:20px;background:#1a0a2e;color:#e8f0f2}h1{color:#4db6ac}.endpoint{background:rgba(26,10,46,0.6);padding:15px;border-radius:8px;margin:10px 0;border-left:4px solid #4db6ac}code{background:rgba(0,0,0,0.3);color:#a5d6a7;padding:2px 6px;border-radius:4px}</style>
</head>
<body>
  <h1>Bridge Route Pinger</h1>
  <p>Cross-chain bridge aggregator with live quotes from Socket and LI.FI</p>
  <div class="endpoint"><strong>Invoke:</strong> <code>POST /entrypoints/bridge-route-pinger/invoke</code></div>
  <div class="endpoint"><strong>Health:</strong> <code>GET /health</code></div>
  <p>$0.08 USDC per request</p>
</body>
</html>`);
});

wrapperApp.all('*', async (c) => honoApp.fetch(c.req.raw));

if (typeof Bun !== 'undefined') {
  Bun.serve({ port: PORT, hostname: HOST, fetch: wrapperApp.fetch });
} else {
  const { serve } = await import('@hono/node-server');
  serve({ fetch: wrapperApp.fetch, port: PORT, hostname: HOST });
}

console.log(`[SUCCESS] ✓ Server running at http://${HOST}:${PORT}`);
