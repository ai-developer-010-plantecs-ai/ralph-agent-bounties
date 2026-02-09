#!/bin/bash

# Bridge Route Pinger - Endpoint Testing Script
# Tests all API endpoints for proper AP2 and x402 compliance

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL (change for production)
BASE_URL="${BASE_URL:-http://localhost:8000}"

echo "Testing Bridge Route Pinger API"
echo "Base URL: $BASE_URL"
echo "=================================="
echo ""

# Test counter
PASSED=0
FAILED=0

# Test function
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local expected_status=$4
    local data=$5

    echo -n "Testing $name... "

    if [ "$method" == "GET" ] || [ "$method" == "HEAD" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$BASE_URL$endpoint")
    else
        response=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi

    if [ "$response" == "$expected_status" ]; then
        echo -e "${GREEN}PASS${NC} (HTTP $response)"
        ((PASSED++))
    else
        echo -e "${RED}FAIL${NC} (Expected HTTP $expected_status, got HTTP $response)"
        ((FAILED++))
    fi
}

# Test with response body
test_endpoint_with_body() {
    local name=$1
    local method=$2
    local endpoint=$3
    local expected_status=$4
    local data=$5

    echo "Testing $name..."

    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi

    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$status" == "$expected_status" ]; then
        echo -e "${GREEN}PASS${NC} (HTTP $status)"
        echo "Response body:"
        echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
        echo ""
        ((PASSED++))
    else
        echo -e "${RED}FAIL${NC} (Expected HTTP $expected_status, got HTTP $status)"
        echo "Response body:"
        echo "$body"
        echo ""
        ((FAILED++))
    fi
}

echo "=== Basic Endpoints ==="
echo ""

# Test health endpoint
test_endpoint_with_body "Health Check (GET /health)" "GET" "/health" "200"

# Test landing page
test_endpoint "Landing Page (GET /)" "GET" "/" "200"

echo ""
echo "=== AP2 Protocol Endpoints ==="
echo ""

# Test agent.json (should return 200)
test_endpoint_with_body "Agent Metadata (GET /.well-known/agent.json)" "GET" "/.well-known/agent.json" "200"

# Test agent.json HEAD
test_endpoint "Agent Metadata HEAD (HEAD /.well-known/agent.json)" "HEAD" "/.well-known/agent.json" "200"

echo ""
echo "=== x402 Protocol Endpoints ==="
echo ""

# Test x402 metadata (should return 402)
test_endpoint_with_body "x402 Metadata (GET /.well-known/x402)" "GET" "/.well-known/x402" "402"

# Test x402 HEAD
test_endpoint "x402 Metadata HEAD (HEAD /.well-known/x402)" "HEAD" "/.well-known/x402" "402"

echo ""
echo "=== Entrypoint Discovery ==="
echo ""

# Test entrypoint GET (should return 402)
test_endpoint "Entrypoint GET (GET /entrypoints/bridge-route-pinger/invoke)" "GET" "/entrypoints/bridge-route-pinger/invoke" "402"

# Test entrypoint HEAD (should return 402)
test_endpoint "Entrypoint HEAD (HEAD /entrypoints/bridge-route-pinger/invoke)" "HEAD" "/entrypoints/bridge-route-pinger/invoke" "402"

echo ""
echo "=== Bridge Routes API ==="
echo ""

# Test bridge routes - USDC Ethereum to Arbitrum
echo "Testing Bridge Routes (POST /bridge/routes) - USDC ETH -> ARB..."
bridge_data='{
  "token": "USDC",
  "amount": "1000000000",
  "from_chain": 1,
  "to_chain": 42161
}'
test_endpoint_with_body "Bridge Routes - USDC ETH->ARB" "POST" "/bridge/routes" "200" "$bridge_data"

# Test bridge routes - ETH Base to Optimism
echo "Testing Bridge Routes (POST /bridge/routes) - ETH Base -> OP..."
bridge_data_2='{
  "token": "ETH",
  "amount": "1000000000000000000",
  "from_chain": 8453,
  "to_chain": 10
}'
test_endpoint_with_body "Bridge Routes - ETH Base->OP" "POST" "/bridge/routes" "200" "$bridge_data_2"

# Test entrypoint POST (should also work in FREE_MODE)
echo "Testing Entrypoint POST (POST /entrypoints/bridge-route-pinger/invoke)..."
test_endpoint_with_body "Entrypoint POST - USDC" "POST" "/entrypoints/bridge-route-pinger/invoke" "200" "$bridge_data"

echo ""
echo "=== Error Handling ==="
echo ""

# Test invalid request (missing required fields)
echo "Testing Invalid Request (missing token)..."
invalid_data='{
  "amount": "1000000000",
  "from_chain": 1,
  "to_chain": 42161
}'
invalid_response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/bridge/routes" \
    -H "Content-Type: application/json" \
    -d "$invalid_data")
invalid_status=$(echo "$invalid_response" | tail -n1)

if [ "$invalid_status" == "422" ]; then
    echo -e "${GREEN}PASS${NC} (HTTP 422 - Validation Error)"
    ((PASSED++))
else
    echo -e "${RED}FAIL${NC} (Expected HTTP 422, got HTTP $invalid_status)"
    ((FAILED++))
fi
echo ""

# Test unsupported chain
echo "Testing Unsupported Chain Pair..."
unsupported_data='{
  "token": "USDC",
  "amount": "1000000000",
  "from_chain": 999999,
  "to_chain": 1
}'
# This should either return routes or 404/400
unsupported_response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/bridge/routes" \
    -H "Content-Type: application/json" \
    -d "$unsupported_data")
unsupported_status=$(echo "$unsupported_response" | tail -n1)
echo -e "${YELLOW}INFO${NC} Unsupported chain returned HTTP $unsupported_status"
echo ""

echo "=== Interactive Documentation ==="
echo ""

# Test Swagger UI
test_endpoint "Swagger UI (GET /docs)" "GET" "/docs" "200"

# Test ReDoc
test_endpoint "ReDoc (GET /redoc)" "GET" "/redoc" "200"

echo ""
echo "=================================="
echo "Test Results"
echo "=================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
