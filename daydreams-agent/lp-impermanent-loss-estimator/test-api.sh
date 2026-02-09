#!/bin/bash

# Test the LP Impermanent Loss Estimator API

BASE_URL="http://localhost:3000"

echo "Testing LP Impermanent Loss Estimator API..."
echo

echo "1. Health check:"
curl -s "$BASE_URL/health" | jq .
echo
echo

echo "2. List entrypoints:"
curl -s "$BASE_URL/entrypoints" | jq .
echo
echo

echo "3. Echo test:"
curl -s -X POST "$BASE_URL/entrypoints/echo/invoke" \
  -H "Content-Type: application/json" \
  -d '{"input": {"text": "Hello, World!"}}' | jq .
echo
echo

echo "4. Calculate IL:"
curl -s -X POST "$BASE_URL/entrypoints/calculate-il/invoke" \
  -H "Content-Type: application/json" \
  -d '{
    "pool_address": "0x88e6A0c2dDD26FEEb64F039a2c41296Fb3966AC1",
    "token_weights": [0.5, 0.5],
    "deposit_amounts": [100, 100],
    "window_hours": 24,
    "current_price": 2000,
    "initial_price": 1800
  }' | jq .
echo
echo

echo "5. Estimate APY:"
curl -s -X POST "$BASE_URL/entrypoints/estimate-apy/invoke" \
  -H "Content-Type: application/json" \
  -d '{
    "tvl": 10000000,
    "volume": 50000000,
    "fee_tier": 0.003,
    "token_weights": [0.5, 0.5]
  }' | jq .
echo
echo

echo "6. Agent manifest:"
curl -s "$BASE_URL/.well-known/agent.json" | jq .
echo
