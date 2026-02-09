import { serve } from "bun";
import { z } from "zod";

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

console.log(`Starting Perps Funding Pulse agent server on port ${port}..`);

// Mock perpetuals funding data (in production, this would fetch from real APIs)
const mockPerpMarkets = [
  {
    venue: "dydx",
    market: "ETH-USD",
    funding_rate: 0.0001,
    time_to_next: 3600, // seconds
    open_interest: 50000000,
    skew: 1.05, // 5% long skew
  },
  {
    venue: "dydx",
    market: "BTC-USD",
    funding_rate: 0.00005,
    time_to_next: 7200,
    open_interest: 80000000,
    skew: 0.95, // 5% short skew
  },
  {
    venue: "polymarket",
    market: "ETH-USD",
    funding_rate: 0.0002,
    time_to_next: 1800,
    open_interest: 30000000,
    skew: 1.1,
  },
  {
    venue: "hyperliquid",
    market: "SOL-USD",
    funding_rate: 0.00015,
    time_to_next: 5400,
    open_interest: 20000000,
    skew: 0.9,
  },
];

// Calculate funding payout
function calculateFundingPayout(
  positionSize: number,
  fundingRate: number,
  leverage: number = 10
): number {
  return positionSize * fundingRate * leverage;
}

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
        entrypoints: ['echo', 'get-funding', 'scan-markets']
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
    
    // Get funding entrypoint
    if (url.pathname === '/entrypoints/get-funding/invoke' && req.method === 'POST') {
      try {
        const { input } = await req.json();
        
        const {
          venue_ids = [],
          markets = [],
        } = input;
        
        // Filter markets by venue and/or market
        let filteredMarkets = mockPerpMarkets;
        if (venue_ids.length > 0) {
          filteredMarkets = filteredMarkets.filter(m => venue_ids.includes(m.venue));
        }
        if (markets.length > 0) {
          filteredMarkets = filteredMarkets.filter(m => markets.includes(m.market));
        }
        
        // Calculate funding payouts
        const results = filteredMarkets.map(market => ({
          venue: market.venue,
          market: market.market,
          funding_rate: market.funding_rate,
          time_to_next: market.time_to_next,
          open_interest: market.open_interest,
          skew: market.skew,
          funding_payout_10x: calculateFundingPayout(100000, market.funding_rate, 10),
          funding_payout_20x: calculateFundingPayout(100000, market.funding_rate, 20),
        }));
        
        return new Response(JSON.stringify({
          output: {
            markets: results,
            total_oi: results.reduce((sum, m) => sum + m.open_interest, 0),
            avg_funding_rate: (results.reduce((sum, m) => sum + m.funding_rate, 0) / results.length).toFixed(8),
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
    
    // Scan markets entrypoint
    if (url.pathname === '/entrypoints/scan-markets/invoke' && req.method === 'POST') {
      try {
        const { input } = await req.json();
        
        const {
          top_n = 5,
          min_open_interest = 0,
        } = input;
        
        // Filter and sort markets
        let filteredMarkets = mockPerpMarkets.filter(m => m.open_interest >= min_open_interest);
        filteredMarkets = filteredMarkets.sort((a, b) => b.open_interest - a.open_interest);
        filteredMarkets = filteredMarkets.slice(0, top_n);
        
        // Find highest funding rate
        const highestFunding = filteredMarkets.reduce((max, m) => 
          m.funding_rate > max.funding_rate ? m : max,
          filteredMarkets[0]
        );
        
        return new Response(JSON.stringify({
          output: {
            markets: filteredMarkets.map(m => ({
              venue: m.venue,
              market: m.market,
              funding_rate: m.funding_rate,
              time_to_next: m.time_to_next,
              open_interest: m.open_interest,
              skew: m.skew,
            })),
            top_funding: highestFunding,
            total_markets_scanned: filteredMarkets.length,
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
        name: process.env.AGENT_NAME ?? 'perps-funding-pulse',
        version: process.env.AGENT_VERSION ?? '0.1.0',
        description: process.env.AGENT_DESCRIPTION ?? 'Fetch current funding rate and open interest for perps markets',
        entrypoints: ['echo', 'get-funding', 'scan-markets'],
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Perps Funding Pulse agent running on http://localhost:${port}`);
