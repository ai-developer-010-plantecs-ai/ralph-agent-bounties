import { z } from "zod";
import { createAgentApp } from "@lucid-agents/hono";
import { createAgent } from "@lucid-agents/core";
import { payments, paymentsFromEnv } from "@lucid-agents/payments";

const agent = await createAgent({
  name: process.env.AGENT_NAME ?? "Yield Pool Watcher",
  version: process.env.AGENT_VERSION ?? "0.1.0",
  description: process.env.AGENT_DESCRIPTION ?? "Track APY and TVL across pools and alert on sharp changes",
})
  .use(payments({ config: paymentsFromEnv() }))
  .build();

const { app, addEntrypoint } = await createAgentApp(agent);

// Mock yield pool data (in production, fetch from DeFi protocols like Aave, Compound, Balancer)
const mockYieldPools = [
  {
    id: "aave-usdc",
    name: "AAVE USDC Pool",
    protocol: "aave",
    apy: 4.2,
    tvl: 150000000,
    tokens: ["USDC"],
    riskScore: 2,
  },
  {
    id: "compound-eth",
    name: "Compound ETH Pool",
    protocol: "compound",
    apy: 2.8,
    tvl: 85000000,
    tokens: ["ETH"],
    riskScore: 3,
  },
  {
    id: "balancer-weth-usdc",
    name: "Balancer WETH-USDC Pool",
    protocol: "balancer",
    apy: 5.1,
    tvl: 45000000,
    tokens: ["WETH", "USDC"],
    riskScore: 4,
  },
  {
    id: "morpho-aave",
    name: "Morpho AAVE",
    protocol: "morpho",
    apy: 4.5,
    tvl: 25000000,
    tokens: ["AAVE"],
    riskScore: 3,
  },
];

// Alert threshold configuration
interface AlertThreshold {
  tvlChangePercent: number;
  apyChangePercent: number;
  timeWindowSeconds: number;
}

const defaultThresholds: AlertThreshold = {
  tvlChangePercent: 10,
  apyChangePercent: 2,
  timeWindowSeconds: 3600,
};

/**
 * Get current yield pool metrics
 */
addEntrypoint({
  key: "get-pools",
  description: "Get current yield pool metrics (APY, TVL, risk score)",
  input: z.object({
    protocol: z.string().optional().describe("Filter by protocol (aave, compound, balancer, morpho)"),
  }),
  handler: async (ctx) => {
    const { protocol } = ctx.input;
    
    let pools = mockYieldPools;
    if (protocol) {
      pools = pools.filter(pool => pool.protocol === protocol);
    }
    
    return {
      output: {
        pools: pools.map(p => ({
          id: p.id,
          name: p.name,
          protocol: p.protocol,
          apy: p.apy,
          tvl: p.tvl,
          tokens: p.tokens,
          riskScore: p.riskScore,
        })),
        timestamp: new Date().toISOString(),
      },
    };
  },
});

/**
 * Monitor pools and detect alerts
 */
addEntrypoint({
  key: "monitor",
  description: "Monitor yield pools and detect alerts based on threshold rules",
  input: z.object({
    thresholds: z.object({
      tvlChangePercent: z.number().optional(),
      apyChangePercent: z.number().optional(),
      timeWindowSeconds: z.number().optional(),
    }).optional().default(defaultThresholds),
    poolIds: z.array(z.string()).optional().describe("Specific pool IDs to monitor"),
  }),
  handler: async (ctx) => {
    const { thresholds, poolIds } = ctx.input;
    
    let pools = mockYieldPools;
    if (poolIds && poolIds.length > 0) {
      pools = pools.filter(pool => poolIds.includes(pool.id));
    }
    
    const alerts = [];
    
    for (const pool of pools) {
      if (pool.apy > 4.5) {
        alerts.push({
          type: "high_apy",
          poolId: pool.id,
          poolName: pool.name,
          currentValue: pool.apy,
          threshold: thresholds.apyChangePercent,
          message: `High APY detected: ${pool.apy}% for ${pool.name}`,
          severity: "warning",
        });
      }
      
      if (pool.tvl > 100000000) {
        alerts.push({
          type: "large_tvl",
          poolId: pool.id,
          poolName: pool.name,
          currentValue: pool.tvl,
          threshold: 100000000,
          message: `Large TVL detected: $${(pool.tvl / 1000000).toFixed(2)}M for ${pool.name}`,
          severity: "info",
        });
      }
    }
    
    return {
      output: {
        pools: pools.map(p => ({
          id: p.id,
          name: p.name,
          protocol: p.protocol,
          apy: p.apy,
          tvl: p.tvl,
          tokens: p.tokens,
          riskScore: p.riskScore,
        })),
        alerts,
        timestamp: new Date().toISOString(),
      },
    };
  },
});

/**
 * Get pool metrics with change detection
 */
addEntrypoint({
  key: "watch-changes",
  description: "Watch for APY and TVL changes beyond thresholds",
  input: z.object({
    poolId: z.string().min(1, "Pool ID required"),
    threshold: z.object({
      tvlChangePercent: z.number().optional().default(10),
      apyChangePercent: z.number().optional().default(2),
    }).optional(),
  }),
  handler: async (ctx) => {
    const { poolId, threshold } = ctx.input;
    
    const pool = mockYieldPools.find(p => p.id === poolId);
    
    if (!pool) {
      return {
        output: {
          error: `Pool not found: ${poolId}`,
          availablePools: mockYieldPools.map(p => p.id),
        },
        statusCode: 404,
      };
    }
    
    const currentApy = pool.apy;
    const currentTvl = pool.tvl;
    
    const simulatedApyChange = (currentApy * 0.15).toFixed(2);
    const simulatedTvlChange = (currentTvl * 0.12).toFixed(0);
    
    const alerts = [];
    
    if (Math.abs(parseFloat(simulatedApyChange)) > threshold.apyChangePercent) {
      alerts.push({
        type: "apy_change",
        poolId: pool.id,
        currentValue: currentApy,
        change: simulatedApyChange,
        message: `APY changed by ${simulatedApyChange}% for ${pool.name}`,
        severity: Math.abs(parseFloat(simulatedApyChange)) > 5 ? "critical" : "warning",
      });
    }
    
    if (Math.abs(parseFloat(simulatedTvlChange)) > threshold.tvlChangePercent) {
      alerts.push({
        type: "tvl_change",
        poolId: pool.id,
        currentValue: currentTvl,
        change: simulatedTvlChange,
        message: `TVL changed by $${simulatedTvlChange} for ${pool.name}`,
        severity: Math.abs(parseFloat(simulatedTvlChange)) > 10000000 ? "critical" : "warning",
      });
    }
    
    return {
      output: {
        pool: {
          id: pool.id,
          name: pool.name,
          protocol: pool.protocol,
          apy: currentApy,
          tvl: currentTvl,
          tokens: pool.tokens,
          riskScore: pool.riskScore,
        },
        changeAnalysis: {
          simulatedApyChange: `${simulatedApyChange}%`,
          simulatedTvlChange: `$${simulatedTvlChange}`,
        },
        alerts,
        timestamp: new Date().toISOString(),
      },
    };
  },
});

/**
 * Health check endpoint
 */
addEntrypoint({
  key: "health",
  description: "Health check for the yield watcher agent",
  handler: async () => {
    return {
      output: {
        status: "healthy",
        agentName: agent.name,
        version: agent.version,
        timestamp: new Date().toISOString(),
      },
    };
  },
});

export { app };
