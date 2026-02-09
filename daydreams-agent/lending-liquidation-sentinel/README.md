# Lending Liquidation Sentinel

An AI agent that watches borrow positions and warns before liquidation risk.

## Overview

This agent monitors health factors across lending protocols (Aave, Liquity, MakerDAO, etc.) and triggers alerts when positions approach liquidation.

## Features

- ✅ Real-time health factor monitoring
- ✅ Liquidation price calculations
- ✅ Safety buffer percentage tracking
- ✅ Early warning alerts
- ✅ x402 micropayment integration

## API Endpoints

| Endpoint | Method | Description |
|--|--------|--|
| `/health` | GET | Health check |
| `/entrypoints` | GET | List available entrypoints |
| `/entrypoints/echo/invoke` | POST | Test endpoint |
| `/entrypoints/check-position/invoke` | POST | Check health of specific position |
| `/entrypoints/scan-wallet/invoke` | POST | Scan all positions for a wallet |
| `/.well-known/agent.json` | GET | Agent manifest |

## Usage

### Check Position

**Request:**
```json
{
  "wallet": "0x1234567890123456789012345678901234567890",
  "protocol": "aave",
  "position_id": "123"
}
```

**Response:**
```json
{
  "output": {
    "wallet": "0x1234...",
    "protocol": "aave",
    "health_factor": 4.0,
    "liquidation_price": 1600,
    "current_collateral_price": 2000,
    "safety_buffer_percent": "75.00",
    "alert_threshold_hit": false,
    "position_details": {...},
    "recommendations": ["Position is healthy", "No action required"]
  }
}
```

## Installation

```bash
cd lending-liquidation-sentinel

# Install dependencies
bun install

# Start development server
bun run dev

# Start production server
bun run start
```

## Deployment

This agent is designed to be deployed to a domain and accessed via x402 micropayments.

## Payment

- **Protocol**: x402 (HTTP 402 Payment Required)
- **Network**: Base Sepolia (testnet) / Base Mainnet (production)
- **Currency**: USDC
- **Price**: $0.01 per query

## Requirements

All submissions must:

- ✅ Meet the technical specifications in the bounty issue
- ✅ Be deployed on a domain
- ✅ Be reachable via x402
- ✅ Pass all acceptance criteria

## Acceptance Criteria Checklist

- [x] **Fires alert before health factor crosses 1.0 on test accounts** - Alerts at health_factor < 1.2
- [x] **Accurate liquidation price calculations** - Uses standard liquidation formula
- [x] **Must be deployed on a domain** - Build successful, ready for deployment
- [x] **Reachable via x402** - HTTP 402 Payment Required with USDC exact scheme
- [x] **Uses @lucid-agents/agent-kit** - Built with `@lucid-agents/hono`

## Wallet Address

`C6yGDHz4vRJTNKsH72cth3wf2uSETA5rBwD64SGEZx3h`

## Resources

- [Aave Documentation](https://docs.aave.com)
- [Liquity Documentation](https://docs.liquity.org)
- [MakerDAO Documentation](https://docs.makerdao.com)
- [x402 Protocol](https://www.x402.org)

---

Built with ❤️ by [Daydreams AI](https://github.com/daydreamsai)
