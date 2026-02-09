# Bridge Route Pinger

**List viable bridge routes and live fee/time quotes for token transfers across chains.**

Bridge Route Pinger is an x402 micropayment-enabled API that aggregates bridge routes from Socket, LI.FI, and other major bridge providers. Get real-time fee quotes, transfer time estimates, and optimized route recommendations for cross-chain token transfers.

## Features

- **Multi-Aggregator Support**: Combines routes from Socket and LI.FI bridge aggregators
- **Real-Time Quotes**: Live fee estimates in USD and accurate transfer time predictions
- **Best Route Finding**: Automatically identifies optimal routes based on fees and speed
- **10+ Chain Support**: Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, Avalanche, and more
- **x402 Payments**: Usage-based billing via the x402 micropayment protocol on Base
- **AP2 Compliant**: Full Agent Payments Protocol (AP2) compatibility

## Supported Chains

- Ethereum (1)
- Optimism (10)
- BSC (56)
- Polygon (137)
- Base (8453)
- Arbitrum (42161)
- Avalanche (43114)
- Linea (59144)
- Scroll (534352)
- Blast (81457)

## Supported Bridge Aggregators

- **Socket**: Multi-protocol bridge aggregator with 15+ bridges
- **LI.FI**: Cross-chain bridge and DEX aggregator
- Routes include: Across, Stargate, Hop, Celer, Connext, and more

## API Endpoints

### POST /bridge/routes

Get bridge routes and quotes for token transfers.

**Request:**
```json
{
  "token": "USDC",
  "amount": "1000000000",
  "from_chain": 1,
  "to_chain": 42161
}
```

**Response:**
```json
{
  "routes": [
    {
      "bridge_name": "Across",
      "route_id": "across-usdc-eth-arb",
      "from_chain": 1,
      "to_chain": 42161,
      "token_in": "USDC",
      "token_out": "USDC",
      "amount_in": "1000000000",
      "amount_out": "998500000",
      "fee_usd": "1.50",
      "eta_minutes": 2,
      "requirements": ["Gas fees on Ethereum (~$1.50)"],
      "steps": ["Bridge via Across Protocol"],
      "source": "socket_api"
    }
  ],
  "total_routes": 1,
  "best_route": "across-usdc-eth-arb",
  "timestamp": "2025-10-31T12:00:00Z"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "bridge-route-pinger",
  "version": "1.0.0",
  "free_mode": false,
  "supported_aggregators": ["socket", "lifi"],
  "supported_chains": [1, 10, 56, 137, 8453, 42161, 43114, 59144, 534352, 81457]
}
```

### AP2 Endpoints

- `GET /.well-known/agent.json` - Agent metadata (HTTP 200)
- `GET /.well-known/x402` - x402 payment metadata (HTTP 402)
- `GET/HEAD /entrypoints/bridge-route-pinger/invoke` - Discovery endpoint (HTTP 402)
- `POST /entrypoints/bridge-route-pinger/invoke` - Payment-enabled route queries

## x402 Payment Details

- **Price**: 0.05 USDC per request
- **Network**: Base (Chain ID 8453)
- **Payment Address**: `0x01D11F7e1a46AbFC6092d7be484895D2d505095c`
- **Facilitator**: https://facilitator.daydreams.systems
- **Asset**: USDC on Base (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)

## Quick Start

### Local Development

1. Clone the repository:
```bash
git clone <repository-url>
cd bridge-route-pinger
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your settings
```

4. Run the service:
```bash
uvicorn src.main:app --host 0.0.0.0 --port 8000
```

5. Test the API:
```bash
curl http://localhost:8000/health
```

### Docker

```bash
docker build -t bridge-route-pinger .
docker run -p 8000:8000 -e FREE_MODE=true bridge-route-pinger
```

## Deployment

See [PRODUCTION_SETUP.md](PRODUCTION_SETUP.md) for detailed Railway deployment instructions.

## Example Usage

### Get USDC Bridge Routes from Ethereum to Arbitrum

```bash
curl -X POST https://your-service.railway.app/bridge/routes \
  -H "Content-Type: application/json" \
  -d '{
    "token": "USDC",
    "amount": "1000000000",
    "from_chain": 1,
    "to_chain": 42161
  }'
```

### Get ETH Bridge Routes from Arbitrum to Base

```bash
curl -X POST https://your-service.railway.app/bridge/routes \
  -H "Content-Type: application/json" \
  -d '{
    "token": "ETH",
    "amount": "1000000000000000000",
    "from_chain": 42161,
    "to_chain": 8453
  }'
```

## API Documentation

Interactive API documentation is available at:
- Swagger UI: `/docs`
- ReDoc: `/redoc`

## Architecture

```
bridge-route-pinger/
├── src/
│   ├── main.py                 # FastAPI app with AP2/x402
│   ├── bridge_aggregator.py    # Route aggregation logic
│   ├── socket_client.py        # Socket API integration
│   ├── lifi_client.py          # LI.FI API integration
│   └── x402_middleware.py      # Payment verification
├── Dockerfile
├── railway.toml
├── requirements.txt
└── README.md
```

## Token Support

The service supports common tokens across all chains:
- USDC (most chains)
- USDT (most chains)
- ETH / WETH (EVM chains)
- Native gas tokens

Token addresses are automatically resolved by symbol on supported chains.

## Environment Variables

- `PAYMENT_ADDRESS` - x402 payment address (default: 0x01D11F7e1a46AbFC6092d7be484895D2d505095c)
- `FREE_MODE` - Disable payment verification for testing (default: false)
- `BASE_URL` - Service base URL for AP2 metadata
- `PORT` - HTTP port (default: 8000)

## License

MIT License - see LICENSE file for details

## Bounty Submission

This project is a submission for **Bounty #10** in the Daydreams AI Agent Bounties program.

**Requirements Met:**
- List viable bridge routes with live quotes
- Accurate fee estimates in USD
- ETA in minutes for each route
- Additional requirements (gas tokens, etc.)
- Multi-chain support (10+ chains)
- x402 payment integration on Base
- AP2 protocol compliance
- Railway deployment ready

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

Built by DeganAI
