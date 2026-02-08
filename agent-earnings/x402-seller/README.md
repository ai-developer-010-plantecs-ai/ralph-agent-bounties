# x402 Seller Implementation

This is a minimal implementation of an x402-compliant seller service that can earn from AI agent micropayments.

## How it Works

1. Service exposes a simple API endpoint
2. When accessed, returns HTTP 402 with payment requirements
3. Client (AI agent) makes payment using x402 protocol
4. Service verifies payment and provides the requested resource

## Earning Potential

- Per-request micropayments (fractions of cents)
- Scalable to thousands of requests per day
- Works with any x402-enabled AI agent

## Setup

```bash
npm install express x402
node server.js
```

## Payment Flow

1. Client makes GET /api/data
2. Server returns 402 with PAYMENT-REQUIRED headers
3. Client signs and sends payment
4. Server verifies and returns data

## Next Steps

- Deploy to production infrastructure
- Integrate with AI agents (Claude, etc.)
- Monitor earnings dashboard
