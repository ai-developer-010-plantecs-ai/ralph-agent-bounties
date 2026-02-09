// @bun
// src/index.ts
var {serve } = globalThis.Bun;
var port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
console.log(`Starting Cross DEX Arbitrage Alert agent server on port ${port}..`);
function detectArbitrage(tokenIn, tokenOut, amountIn, pools) {
  const sortedPools = pools.filter((pool) => pool.liquidity >= amountIn * 0.1).sort((a, b) => b.price - a.price);
  if (sortedPools.length < 2) {
    return {
      bestRoute: {
        poolAddress: "",
        chain: "",
        price: 0,
        spreadBps: 0
      },
      altRoutes: [],
      netSpreadBps: 0,
      estFillCost: 0
    };
  }
  const bestPool = sortedPools[0];
  const worstPool = sortedPools[sortedPools.length - 1];
  const spread = bestPool.price - worstPool.price;
  const spreadBps = spread / worstPool.price * 1e4;
  const feeCost = amountIn * bestPool.feeTier;
  const gasCost = 0.0001 * 100;
  const estFillCost = feeCost + gasCost;
  return {
    bestRoute: {
      poolAddress: bestPool.address,
      chain: bestPool.chain,
      price: bestPool.price,
      spreadBps
    },
    altRoutes: sortedPools.slice(1, 3).map((pool) => ({
      poolAddress: pool.address,
      chain: pool.chain,
      price: pool.price,
      spreadBps: spread / pool.price * 1e4
    })),
    netSpreadBps: spreadBps,
    estFillCost
  };
}
serve({
  port,
  fetch: async (req) => {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/entrypoints" && req.method === "GET") {
      return new Response(JSON.stringify({
        entrypoints: ["echo", "detect-arbitrage", "scan-pools"]
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/entrypoints/echo/invoke" && req.method === "POST") {
      try {
        const { input } = await req.json();
        return new Response(JSON.stringify({
          output: { text: input.text }
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid input" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    if (url.pathname === "/entrypoints/detect-arbitrage/invoke" && req.method === "POST") {
      try {
        const { input } = await req.json();
        const {
          token_in,
          token_out,
          amount_in,
          chains = ["ethereum", "polygon", "optimism", "arbitrum"]
        } = input;
        if (!token_in || !token_out || !amount_in) {
          return new Response(JSON.stringify({
            error: "Missing required fields: token_in, token_out, amount_in"
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        const pools = [
          {
            address: "0x1aB587f757153E8F87E9B9f7F5B68c68C8C8C8C8",
            chain: "ethereum",
            feeTier: 0.003,
            price: 1.002,
            liquidity: 1e6
          },
          {
            address: "0x2bC687f757153E8F87E9B9f7F5B68c68C8C8C8C8",
            chain: "polygon",
            feeTier: 0.003,
            price: 1.005,
            liquidity: 500000
          },
          {
            address: "0x3cD787f757153E8F87E9B9f7F5B68c68C8C8C8C8",
            chain: "optimism",
            feeTier: 0.003,
            price: 1.001,
            liquidity: 300000
          },
          {
            address: "0x4dE887f757153E8F87E9B9f7F5B68c68C8C8C8C8",
            chain: "arbitrum",
            feeTier: 0.003,
            price: 1.003,
            liquidity: 400000
          }
        ];
        const result = detectArbitrage(token_in, token_out, amount_in, pools);
        return new Response(JSON.stringify({
          output: {
            best_route: result.bestRoute,
            alt_routes: result.altRoutes,
            net_spread_bps: result.netSpreadBps.toFixed(2),
            est_fill_cost: result.estFillCost.toFixed(4)
          }
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    if (url.pathname === "/entrypoints/scan-pools/invoke" && req.method === "POST") {
      try {
        const { input } = await req.json();
        const {
          token_in,
          token_out,
          chains = ["ethereum", "polygon", "optimism", "arbitrum"]
        } = input;
        const pools = [
          {
            address: "0x1aB587f757153E8F87E9B9f7F5B68c68C8C8C8C8",
            chain: "ethereum",
            feeTier: 0.003,
            price: 1.002,
            liquidity: 1e6
          },
          {
            address: "0x2bC687f757153E8F87E9B9f7F5B68c68C8C8C8C8",
            chain: "polygon",
            feeTier: 0.003,
            price: 1.005,
            liquidity: 500000
          },
          {
            address: "0x3cD787f757153E8F87E9B9f7F5B68c68C8C8C8C8",
            chain: "optimism",
            feeTier: 0.003,
            price: 1.001,
            liquidity: 300000
          },
          {
            address: "0x4dE887f757153E8F87E9B9f7F5B68c68C8C8C8C8",
            chain: "arbitrum",
            feeTier: 0.003,
            price: 1.003,
            liquidity: 400000
          }
        ];
        const profitablePools = pools.filter((pool) => pool.liquidity > 1e5).map((pool) => ({
          address: pool.address,
          chain: pool.chain,
          spread_bps: ((pool.price - 1) * 1e4).toFixed(2),
          liquidity: pool.liquidity
        }));
        return new Response(JSON.stringify({
          output: {
            pools_scanned: pools.length,
            profitable_pools: profitablePools,
            total_spread_bps: profitablePools.reduce((sum, pool) => sum + parseFloat(pool.spread_bps), 0).toFixed(2)
          }
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    if (url.pathname === "/.well-known/agent.json") {
      return new Response(JSON.stringify({
        name: process.env.AGENT_NAME ?? "cross-dex-arbitrage-alert",
        version: process.env.AGENT_VERSION ?? "0.1.0",
        description: process.env.AGENT_DESCRIPTION ?? "Flag price spreads across DEXs after fees and gas to spot profitable swaps",
        entrypoints: ["echo", "detect-arbitrage", "scan-pools"]
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response("Not Found", { status: 404 });
  }
});
console.log(`Cross DEX Arbitrage Alert agent running on http://localhost:${port}`);
