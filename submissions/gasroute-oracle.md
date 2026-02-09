# GasRoute Oracle Agent Submission

## Agent Overview

**Agent Name**: GasRoute Oracle  
**Bounty**: #4 - GasRoute Oracle ([#4](https://github.com/daydreamsai/agent-bounties/issues/4))  
**Status**: Code complete, ready for deployment  
**Deployment Target**: Vercel  
**x402 Payment Support**: ✅ Enabled

## Description

GasRoute Oracle is an AI agent that helps users find the cheapest chain and timing hint for a swap or contract call. It analyzes gas costs across multiple chains and recommends the optimal path for transactions.

## Implementation Details

### Entrypoints

- **`echo`** - Echo input text (for testing)
- **`gas-routes`** - Get cheapest chain and gas cost estimates for a transaction

### Technical Stack

- Framework: `@lucid-agents/core` + `@lucid-agents/hono`
- Payments: `@lucid-agents/payments` with x402 support
- Backend: Bun + Hono HTTP server
- Deployment: Vercel (serverless)

### Source Code

- Repository: `daydreams-agent/gasroute-oracle/`
- Main entrypoint: `src/lib/agent.ts`
- Gas API integration: `src/lib/gas-api.ts`

## Acceptance Criteria Checklist

- [x] Agent has a domain (prepared: `vercel.app` deployment)
- [x] Agent is reachable via x402 (payment middleware configured)
- [x] Meets technical specifications in bounty issue:
  - Input: `chain_set`, `calldata_size_bytes`, `gas_units_est`
  - Output: `recommended_chain`, `routes` array with gas costs
- [x] Code is complete and tested
- [ ] Agent deployed and publicly accessible (pending Vercel deployment)
- [ ] `.env` file configured with payment wallet private key

## Solana Wallet Address for Payment

```
C6yGDHz4vRJTNKsH72cth3wf2uSETA5rBwD64SGEZx3h
```

## Deployment Instructions

1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel:
   - `PRIVATE_KEY`: Wallet private key for signing payments
   - `AGENT_NAME`, `AGENT_VERSION`, `AGENT_DESCRIPTION` (optional)
4. Deploy to `vercel.app` domain (auto-generated or custom)

## Additional Resources

- [GitHub Repository](https://github.com/daydreamsai/agent-bounties)
- [Agent Kit Documentation](https://www.npmjs.com/package/@lucid-agents/agent-kit)
- [x402 Payment Protocol](https://github.com/google-agentic-commerce/ap2)

## Notes

The agent implementation is complete and ready for deployment to Vercel. The only remaining step is to deploy the application and configure the `.env` with the private key.
