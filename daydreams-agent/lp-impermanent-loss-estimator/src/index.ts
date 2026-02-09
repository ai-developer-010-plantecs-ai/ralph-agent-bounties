import { serve } from "bun";
import { z } from "zod";

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

console.log(`Starting LP Impermanent Loss Estimator agent server on port ${port}..`);

// Simple IL calculation function
function calculateImpermanentLoss(
  priceRatio: number,
  tokenWeightA: number,
  tokenWeightB: number
): number {
  // Impermanent Loss formula for 50/50 pool:
  // IL% = (sqrt(priceRatio) - priceRatio) / (sqrt(priceRatio) + 1) * 100
  // Generalized for any weight ratio
  
  const sqrtRatio = Math.sqrt(priceRatio);
  const weightDiff = tokenWeightA - tokenWeightB;
  const weightedRatio = priceRatio ** weightDiff;
  
  const valueHold = 1; // Value if tokens were held
  const valuePool = 
    tokenWeightA * (weightedRatio ** tokenWeightA) + 
    tokenWeightB * (weightedRatio ** -tokenWeightB);
  
  const ilPercent = ((valuePool - valueHold) / valueHold) * 100;
  
  return ilPercent;
}

// Fee APR estimation (simplified)
function estimateFeeAPR(
  volume: number,
  tvl: number,
  feeTier: number = 0.003 // Default 0.3% fee tier
): number {
  // Annualized fee revenue / TVL
  const dailyFees = volume * feeTier;
  const annualFees = dailyFees * 365;
  const feeApr = (annualFees / tvl) * 100;
  
  return feeApr;
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
        entrypoints: ['echo', 'calculate-il', 'estimate-apy']
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
    
    // Calculate IL entrypoint
    if (url.pathname === '/entrypoints/calculate-il/invoke' && req.method === 'POST') {
      try {
        const { input } = await req.json();
        
        const {
          pool_address,
          token_weights,
          deposit_amounts,
          window_hours,
          current_price,
          initial_price
        } = input;
        
        // Validate inputs
        if (!pool_address || !token_weights || !current_price || !initial_price) {
          return new Response(JSON.stringify({ 
            error: 'Missing required fields: pool_address, token_weights, current_price, initial_price' 
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        const priceRatio = current_price / initial_price;
        const weightA = token_weights[0] || 0.5;
        const weightB = token_weights[1] || (1 - weightA);
        
        const ilPercent = calculateImpermanentLoss(priceRatio, weightA, weightB);
        
        // Estimate fees if volume and TVL provided
        let feeAprEst = 0;
        if (input.volume && input.tvl) {
          feeAprEst = estimateFeeAPR(input.volume, input.tvl, input.fee_tier);
        }
        
        return new Response(JSON.stringify({
          output: {
            il_percent: ilPercent.toFixed(4),
            fee_apr_est: feeAprEst.toFixed(4),
            volume_window: input.volume ? input.volume.toString() : 'N/A',
            notes: `IL calculation based on price ratio ${priceRatio.toFixed(4)} and token weights [${weightA}, ${weightB}]. Fee APR is estimated based on provided volume and TVL.`
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
    
    // Estimate APY entrypoint
    if (url.pathname === '/entrypoints/estimate-apy/invoke' && req.method === 'POST') {
      try {
        const { input } = await req.json();
        
        const {
          tvl,
          volume,
          fee_tier = 0.003,
          token_weights = [0.5, 0.5]
        } = input;
        
        const feeApr = estimateFeeAPR(volume, tvl, fee_tier);
        
        // Estimate IL for different price scenarios
        const scenarios = [
          { priceChange: 1.1, il: calculateImpermanentLoss(1.1, token_weights[0], token_weights[1]) },
          { priceChange: 1.2, il: calculateImpermanentLoss(1.2, token_weights[0], token_weights[1]) },
          { priceChange: 1.5, il: calculateImpermanentLoss(1.5, token_weights[0], token_weights[1]) },
          { priceChange: 2.0, il: calculateImpermanentLoss(2.0, token_weights[0], token_weights[1]) }
        ];
        
        return new Response(JSON.stringify({
          output: {
            fee_apr_est: feeApr.toFixed(4),
            scenarios: scenarios.map(s => ({
              price_change_percent: ((s.priceChange - 1) * 100).toFixed(2),
              il_percent: s.il.toFixed(4)
            })),
            notes: `APY estimate includes fee revenue minus estimated IL for various price scenarios.`
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
        name: process.env.AGENT_NAME ?? 'lp-impermanent-loss-estimator',
        version: process.env.AGENT_VERSION ?? '0.1.0',
        description: process.env.AGENT_DESCRIPTION ?? 'Calculate IL and fee APR for any LP position or simulated deposit',
        entrypoints: ['echo', 'calculate-il', 'estimate-apy'],
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('Not Found', { status: 404 });
  },
});

console.log(`LP Impermanent Loss Estimator agent running on http://localhost:${port}`);
