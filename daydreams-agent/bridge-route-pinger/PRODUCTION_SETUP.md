# Production Setup Guide - Bridge Route Pinger

This guide walks through deploying Bridge Route Pinger to Railway with x402 payment integration.

## Prerequisites

- Railway account (https://railway.app)
- GitHub account
- Base wallet with USDC for testing payments

## Step 1: Push to GitHub

1. Create a new GitHub repository:
```bash
# On GitHub, create a new repository named "bridge-route-pinger"
# Do NOT initialize with README (we already have one)
```

2. Push the code:
```bash
cd bridge-route-pinger
git remote add origin https://github.com/YOUR_USERNAME/bridge-route-pinger.git
git push -u origin main
```

## Step 2: Deploy to Railway

1. Go to https://railway.app and sign in
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose the `bridge-route-pinger` repository
5. Railway will auto-detect the Dockerfile and railway.toml

## Step 3: Configure Environment Variables

In the Railway dashboard, add these environment variables:

### Required Variables

```bash
PAYMENT_ADDRESS=0x01D11F7e1a46AbFC6092d7be484895D2d505095c
FREE_MODE=false
BASE_URL=https://bridge-route-pinger-production.up.railway.app
```

**IMPORTANT**: Replace `BASE_URL` with your actual Railway deployment URL after the first deployment.

### Optional Variables

```bash
PORT=8000  # Railway will auto-set this, but you can override
```

## Step 4: First Deployment

1. Railway will automatically deploy on push
2. Wait for the build to complete (2-3 minutes)
3. Check logs for any errors
4. Note your deployment URL (e.g., `https://bridge-route-pinger-production.up.railway.app`)

## Step 5: Update BASE_URL

1. Copy your Railway deployment URL
2. Update the `BASE_URL` environment variable in Railway
3. Redeploy (Railway will auto-redeploy on variable change)

## Step 6: Verify Deployment

### Test Health Endpoint

```bash
curl https://your-service.railway.app/health
```

Expected response:
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

### Test AP2 Metadata

```bash
curl https://your-service.railway.app/.well-known/agent.json
```

Should return HTTP 200 with agent metadata.

### Test x402 Discovery

```bash
curl -I https://your-service.railway.app/.well-known/x402
```

Should return HTTP 402 with payment metadata.

### Test Entrypoint Discovery

```bash
curl -I https://your-service.railway.app/entrypoints/bridge-route-pinger/invoke
```

Should return HTTP 402.

## Step 7: Test Bridge Route API

### Test USDC Bridge from Ethereum to Arbitrum

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

### Test ETH Bridge from Base to Optimism

```bash
curl -X POST https://your-service.railway.app/bridge/routes \
  -H "Content-Type: application/json" \
  -d '{
    "token": "ETH",
    "amount": "1000000000000000000",
    "from_chain": 8453,
    "to_chain": 10
  }'
```

Expected response includes:
- List of bridge routes from Socket and LI.FI
- Fee estimates in USD
- ETA in minutes
- Best route recommendation
- Step-by-step instructions
- Gas requirements

## Step 8: Enable x402 Payments

When ready for production:

1. Ensure `FREE_MODE=false` in Railway environment variables
2. Configure payment verification in `x402_middleware.py`
3. Test with x402-enabled client
4. Monitor payment receipts on Base

## Step 9: Monitor Logs

```bash
# In Railway dashboard:
# 1. Click on your service
# 2. Go to "Deployments" tab
# 3. Click "View Logs" on the latest deployment
```

Key logs to watch:
- "Bridge Route Pinger initialized"
- "Bridge aggregator initialized"
- API request logs with route counts
- Any error messages from Socket or LI.FI APIs

## Troubleshooting

### Build Fails

- Check Dockerfile syntax
- Ensure all dependencies are in requirements.txt
- Review Railway build logs

### Service Crashes

- Check Railway logs for Python errors
- Verify environment variables are set
- Ensure PORT is correctly configured

### API Returns No Routes

- Check Socket and LI.FI API status
- Verify token addresses are correct
- Ensure chain IDs are supported
- Review API rate limits

### x402 Not Working

- Verify `PAYMENT_ADDRESS` is correct
- Ensure `BASE_URL` matches your Railway URL
- Check facilitator endpoint is accessible
- Review x402 middleware logs

## Production Checklist

- [ ] Code pushed to GitHub
- [ ] Railway deployment successful
- [ ] Environment variables configured
- [ ] BASE_URL updated with actual URL
- [ ] Health endpoint returns 200
- [ ] Agent.json returns 200
- [ ] x402 metadata returns 402
- [ ] Entrypoint returns 402
- [ ] Bridge routes API working
- [ ] Routes from Socket aggregator
- [ ] Routes from LI.FI aggregator
- [ ] Fee estimates accurate
- [ ] Time estimates reasonable
- [ ] Best route calculated correctly
- [ ] FREE_MODE set to false for production
- [ ] Logs clean and informative

## API Rate Limits

### Socket API
- Public API key included (demo key)
- Rate limit: ~100 requests/minute
- For production, get your own API key at https://socket.tech

### LI.FI API
- No API key required for public endpoints
- Rate limit: ~60 requests/minute
- For higher limits, register at https://li.fi

## Scaling

Railway auto-scales based on:
- CPU usage
- Memory usage
- Request volume

Default configuration:
- 4 Gunicorn workers
- 30-second timeout
- Auto-restart on failure

To adjust workers:
```bash
# In railway.toml, modify startCommand:
startCommand = "sh -c 'gunicorn src.main:app -w 8 -k uvicorn.workers.UvicornWorker ...'"
```

## Cost Estimates

### Railway Costs
- Hobby Plan: $5/month (includes $5 credit)
- Usage-based pricing after free tier
- Typical cost: $5-15/month for moderate traffic

### Bridge API Costs
- Socket: Free for public API
- LI.FI: Free for public API
- x402 payments: 0.05 USDC per request (revenue)

## Security Notes

1. **Payment Address**: Never commit private keys
2. **API Keys**: Use environment variables for any API keys
3. **Rate Limiting**: Consider adding rate limiting for production
4. **Input Validation**: Request validation is handled by Pydantic
5. **CORS**: Currently set to allow all origins - restrict in production if needed

## Support

- Railway Docs: https://docs.railway.app
- Socket Docs: https://docs.socket.tech
- LI.FI Docs: https://docs.li.fi
- x402 Spec: https://github.com/daydreamsai/x402

## Next Steps

1. Monitor initial production traffic
2. Gather route accuracy data
3. Add more bridge aggregators (Jumper, Squid, etc.)
4. Implement caching for frequent routes
5. Add analytics and monitoring
6. Set up alerts for API failures

---

**Production URL Template**: https://bridge-route-pinger-production.up.railway.app

Ready to bridge! 🌉
