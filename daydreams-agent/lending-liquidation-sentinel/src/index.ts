import { serve } from "bun";
import { z } from "zod";

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

console.log(`Starting Lending Liquidation Sentinel agent server on port ${port}..`);

// Mock lending positions (in production, this would fetch from real APIs)
const mockPositions = [
  {
    wallet: "0x1234567890123456789012345678901234567890",
    protocol: "aave",
    collateral: 1000,
    collateral_price: 2000,
    debt: 500,
    debt_price: 1,
    health_factor: 4.0,
    liquidation_threshold: 0.8,
  },
  {
    wallet: "0x2345678901234567890123456789012345678901",
    protocol: "liquity",
    collateral: 2,
    collateral_price: 2500,
    debt: 1500,
    debt_price: 1,
    health_factor: 1.33,
    liquidation_threshold: 0.8,
  },
  {
    wallet: "0x3456789012345678901234567890123456789012",
    protocol: "makerdao",
    collateral: 10,
    collateral_price: 3000,
    debt: 15000,
    debt_price: 1,
    health_factor: 1.1,
    liquidation_threshold: 0.9,
  },
];

// Calculate liquidation price
function calculateLiquidationPrice(
  collateral: number,
  collateralPrice: number,
  debt: number,
  liquidationThreshold: number
): number {
  // Liquidation price = (debt / collateral) / liquidation_threshold
  return (debt / collateral) / liquidationThreshold;
}

// Calculate safety buffer
function calculateSafetyBuffer(healthFactor: number): number {
  return ((healthFactor - 1.0) / healthFactor) * 100;
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
        entrypoints: ['echo', 'check-position', 'scan-wallet']
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
    
    // Check position entrypoint
    if (url.pathname === '/entrypoints/check-position/invoke' && req.method === 'POST') {
      try {
        const { input } = await req.json();
        
        const {
          wallet,
          protocol,
          position_id,
        } = input;
        
        // Find the position
        let position = mockPositions.find(p => 
          p.wallet === wallet && 
          p.protocol === protocol
        );
        
        if (!position) {
          return new Response(JSON.stringify({ 
            error: 'Position not found' 
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        const liquidationPrice = calculateLiquidationPrice(
          position.collateral,
          position.collateral_price,
          position.debt,
          position.liquidation_threshold
        );
        
        const safetyBuffer = calculateSafetyBuffer(position.health_factor);
        
        // Check if alert should fire (health factor < 1.2 or safety buffer < 20%)
        const shouldAlert = position.health_factor < 1.2 || safetyBuffer < 20;
        
        return new Response(JSON.stringify({
          output: {
            wallet: position.wallet,
            protocol: position.protocol,
            health_factor: position.health_factor,
            liquidation_price: liquidationPrice,
            current_collateral_price: position.collateral_price,
            safety_buffer_percent: safetyBuffer.toFixed(2),
            alert_threshold_hit: shouldAlert,
            position_details: {
              collateral: position.collateral,
              collateral_value: position.collateral * position.collateral_price,
              debt: position.debt,
              debt_to_collateral_ratio: (position.debt / (position.collateral * position.collateral_price)).toFixed(4),
            },
            recommendations: shouldAlert 
              ? ['Reduce debt immediately', 'Add more collateral', 'Monitor closely']
              : ['Position is healthy', 'No action required'],
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
    
    // Scan wallet entrypoint
    if (url.pathname === '/entrypoints/scan-wallet/invoke' && req.method === 'POST') {
      try {
        const { input } = await req.json();
        
        const {
          wallet,
          protocol_ids = [],
          alert_threshold = 1.2,
        } = input;
        
        // Filter positions by wallet
        let positions = mockPositions.filter(p => p.wallet === wallet);
        
        // Filter by protocol if specified
        if (protocol_ids.length > 0) {
          positions = positions.filter(p => protocol_ids.includes(p.protocol));
        }
        
        // Check each position
        const results = positions.map(position => {
          const liquidationPrice = calculateLiquidationPrice(
            position.collateral,
            position.collateral_price,
            position.debt,
            position.liquidation_threshold
          );
          
          const safetyBuffer = calculateSafetyBuffer(position.health_factor);
          const shouldAlert = position.health_factor < alert_threshold;
          
          return {
            protocol: position.protocol,
            health_factor: position.health_factor,
            liquidation_price: liquidationPrice,
            current_collateral_price: position.collateral_price,
            safety_buffer_percent: safetyBuffer.toFixed(2),
            alert_threshold_hit: shouldAlert,
            position_details: {
              collateral: position.collateral,
              collateral_value: position.collateral * position.collateral_price,
              debt: position.debt,
            },
          };
        });
        
        // Find positions with alerts
        const alertPositions = results.filter(p => p.alert_threshold_hit);
        
        return new Response(JSON.stringify({
          output: {
            total_positions: results.length,
            positions_at_risk: alertPositions.length,
            positions: results,
            overall_risk: alertPositions.length > 0 ? 'HIGH' : 'LOW',
            recommendations: alertPositions.length > 0 
              ? ['Review positions immediately', 'Consider deleveraging']
              : ['All positions are healthy', 'No action required'],
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
        name: process.env.AGENT_NAME ?? 'lending-liquidation-sentinel',
        version: process.env.AGENT_VERSION ?? '0.1.0',
        description: process.env.AGENT_DESCRIPTION ?? 'Watch borrow positions and warn before liquidation risk',
        entrypoints: ['echo', 'check-position', 'scan-wallet'],
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Lending Liquidation Sentinel agent running on http://localhost:${port}`);
