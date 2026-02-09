"""
Bridge Route Pinger - List viable bridge routes and live fee/time quotes

x402 micropayment-enabled bridge route aggregation service
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional
import os
import logging
from datetime import datetime

from src.bridge_aggregator import BridgeAggregator, BridgeRoute
from src.x402_middleware_dual import X402Middleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="Bridge Route Pinger",
    description="List viable bridge routes and live fee/time quotes for token transfers - powered by x402",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configuration
payment_address = os.getenv("PAYMENT_ADDRESS", "0x01D11F7e1a46AbFC6092d7be484895D2d505095c")
base_url = os.getenv("BASE_URL", "https://bridge-route-pinger-production.up.railway.app")
free_mode = os.getenv("FREE_MODE", "false").lower() == "true"

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# x402 Payment Verification Middleware
app.add_middleware(
    X402Middleware,
    payment_address=payment_address,
    base_url=base_url,
    facilitator_urls=[
        "https://facilitator.daydreams.systems",
        "https://api.cdp.coinbase.com/platform/v2/x402/facilitator"
    ],
    free_mode=free_mode,
)

# Initialize Bridge Aggregator
bridge_aggregator = BridgeAggregator()
logger.info("Bridge Route Pinger initialized")

if free_mode:
    logger.warning("Running in FREE MODE - no payment verification")


# Request/Response Models
class BridgeRequest(BaseModel):
    """Request for bridge route quotes"""
    token: str = Field(
        ...,
        description="Token symbol or address to bridge",
        example="USDC"
    )
    amount: str = Field(
        ...,
        description="Amount to transfer in token decimals",
        example="1000000000"
    )
    from_chain: int = Field(
        ...,
        description="Source chain ID (1=Ethereum, 42161=Arbitrum, 10=Optimism, 8453=Base, 137=Polygon)",
        example=1
    )
    to_chain: int = Field(
        ...,
        description="Destination chain ID",
        example=42161
    )


class BridgeResponse(BaseModel):
    """Bridge routes response"""
    routes: List[BridgeRoute]
    total_routes: int
    best_route: Optional[str] = Field(None, description="Route ID with best combination of fee and time")
    timestamp: str


# Endpoints
@app.get("/", response_class=HTMLResponse)
@app.head("/")
async def root():
    """Landing page"""
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bridge Route Pinger - Cross-Chain Bridge Quotes</title>
        <meta name="description" content="List viable bridge routes and live fee/time quotes for token transfers via x402 micropayments">
        <meta property="og:title" content="Bridge Route Pinger">
        <meta property="og:description" content="List viable bridge routes and live fee/time quotes for token transfers via x402 micropayments">
        <meta property="og:image" content="https://bridge-route-pinger-production-1647.up.railway.app/favicon.ico">
        <link rel="icon" type="image/x-icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌉</text></svg>">
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                background: linear-gradient(135deg, #1a0a2e 0%, #16213e 50%, #0f3460 100%);
                color: #e8f0f2;
                line-height: 1.6;
                min-height: 100vh;
            }}
            .container {{ max-width: 1200px; margin: 0 auto; padding: 20px; }}
            header {{
                background: linear-gradient(135deg, rgba(77, 182, 172, 0.15) 0%, rgba(77, 219, 255, 0.15) 100%);
                border: 2px solid rgba(77, 182, 172, 0.3);
                border-radius: 15px;
                padding: 40px;
                margin-bottom: 30px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
            }}
            h1 {{
                color: #4db6ac;
                font-size: 2.5em;
                margin-bottom: 10px;
                text-shadow: 0 2px 10px rgba(77, 182, 172, 0.3);
            }}
            .subtitle {{
                color: #80deea;
                font-size: 1.2em;
                margin-bottom: 15px;
            }}
            .badge {{
                display: inline-block;
                background: rgba(77, 182, 172, 0.2);
                border: 1px solid rgba(77, 182, 172, 0.4);
                color: #4db6ac;
                padding: 6px 15px;
                border-radius: 20px;
                font-size: 0.9em;
                margin-right: 10px;
                margin-top: 10px;
                font-weight: 600;
            }}
            .section {{
                background: rgba(22, 33, 62, 0.8);
                border: 1px solid rgba(77, 182, 172, 0.2);
                border-radius: 12px;
                padding: 30px;
                margin-bottom: 30px;
                box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
            }}
            h2 {{
                color: #4db6ac;
                margin-bottom: 20px;
                font-size: 1.8em;
                border-bottom: 2px solid rgba(77, 182, 172, 0.3);
                padding-bottom: 10px;
            }}
            h3 {{
                color: #80deea;
                margin: 15px 0 10px 0;
                font-size: 1.3em;
            }}
            .endpoint {{
                background: rgba(26, 10, 46, 0.6);
                border-left: 4px solid #4db6ac;
                padding: 20px;
                margin: 20px 0;
                border-radius: 8px;
            }}
            .method {{
                display: inline-block;
                background: #4db6ac;
                color: white;
                padding: 5px 12px;
                border-radius: 5px;
                font-weight: bold;
                font-size: 0.85em;
                margin-right: 10px;
            }}
            .method.get {{ background: #4CAF50; }}
            code {{
                background: rgba(0, 0, 0, 0.3);
                color: #a5d6a7;
                padding: 2px 6px;
                border-radius: 3px;
                font-family: 'Monaco', 'Courier New', monospace;
            }}
            pre {{
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(77, 182, 172, 0.2);
                border-radius: 6px;
                padding: 15px;
                overflow-x: auto;
                margin: 10px 0;
            }}
            pre code {{
                background: none;
                padding: 0;
                display: block;
                color: #a5d6a7;
            }}
            .grid {{
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                gap: 20px;
                margin: 20px 0;
            }}
            .card {{
                background: rgba(26, 10, 46, 0.6);
                border: 1px solid rgba(77, 182, 172, 0.2);
                border-radius: 10px;
                padding: 20px;
            }}
            .card h4 {{
                color: #4db6ac;
                margin-bottom: 10px;
                font-size: 1.2em;
            }}
            .highlight {{
                color: #4db6ac;
                font-weight: bold;
            }}
            a {{
                color: #80deea;
                text-decoration: none;
                border-bottom: 1px solid transparent;
                transition: all 0.3s ease;
            }}
            a:hover {{
                border-bottom-color: #80deea;
            }}
            footer {{
                text-align: center;
                padding: 30px 20px;
                color: #80cbc4;
                opacity: 0.8;
            }}
            .status-indicator {{
                display: inline-block;
                width: 10px;
                height: 10px;
                background: #4caf50;
                border-radius: 50%;
                margin-right: 8px;
                animation: pulse 2s infinite;
            }}
            @keyframes pulse {{
                0%, 100% {{ opacity: 1; }}
                50% {{ opacity: 0.5; }}
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <header>
                <h1>Bridge Route Pinger</h1>
                <p class="subtitle">Find the Best Bridge Routes for Your Tokens</p>
                <p style="font-size: 0.95em; color: #b8c5d6; margin: 10px 0 15px 0;">Compare routes, fees, and transfer times across major bridge aggregators</p>
                <div>
                    <span class="badge"><span class="status-indicator"></span>Live Quotes</span>
                    <span class="badge">Multiple Bridges</span>
                    <span class="badge">10+ Chains</span>
                    <span class="badge">x402 Payments</span>
                </div>
            </header>

            <div class="section">
                <h2>What is Bridge Route Pinger?</h2>
                <p style="font-size: 1.1em; line-height: 1.8; margin-top: 15px;">
                    Bridge Route Pinger aggregates bridge routes from <span class="highlight">Socket, LI.FI, and other major bridge aggregators</span>
                    to help you find the best way to transfer tokens across chains. Get real-time fee quotes, transfer times, and route comparisons.
                </p>

                <div class="grid" style="margin-top: 30px;">
                    <div class="card">
                        <h4>Best Route Finding</h4>
                        <p>Automatically identifies the optimal route based on fees, speed, and reliability.</p>
                    </div>
                    <div class="card">
                        <h4>Live Fee Quotes</h4>
                        <p>Real-time bridge fees in USD for accurate cost comparison across routes.</p>
                    </div>
                    <div class="card">
                        <h4>Time Estimates</h4>
                        <p>Accurate transfer time predictions from minutes to hours based on bridge type.</p>
                    </div>
                    <div class="card">
                        <h4>Multi-Chain Support</h4>
                        <p>Support for Ethereum, Arbitrum, Optimism, Base, Polygon, and 10+ other chains.</p>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>API Endpoints</h2>

                <div class="endpoint">
                    <h3><span class="method">POST</span>/bridge/routes</h3>
                    <p>Get bridge routes and quotes for token transfers</p>
                    <pre><code>curl -X POST https://your-service.railway.app/bridge/routes \\
  -H "Content-Type: application/json" \\
  -d '{{
    "token": "USDC",
    "amount": "1000000000",
    "from_chain": 1,
    "to_chain": 42161
  }}'</code></pre>
                </div>

                <div class="endpoint">
                    <h3><span class="method">POST</span>/entrypoints/bridge-route-pinger/invoke</h3>
                    <p>AP2-compatible entrypoint for bridge route queries</p>
                </div>

                <div class="endpoint">
                    <h3><span class="method get">GET</span>/health</h3>
                    <p>Health check and operational status</p>
                </div>
            </div>

            <div class="section">
                <h2>Supported Bridge Aggregators</h2>
                <div class="grid">
                    <div class="card"><h4>Socket</h4><p>Multi-protocol bridge aggregator with 15+ bridges</p></div>
                    <div class="card"><h4>LI.FI</h4><p>Cross-chain bridge and DEX aggregator</p></div>
                    <div class="card"><h4>Across Protocol</h4><p>Intent-based bridge with optimistic verification</p></div>
                    <div class="card"><h4>Stargate</h4><p>Omnichain liquidity transport protocol</p></div>
                </div>
            </div>

            <div class="section">
                <h2>x402 Micropayments</h2>
                <p style="margin-bottom: 20px;">
                    Uses the <strong>x402 payment protocol</strong> for usage-based billing.
                </p>

                <div class="grid">
                    <div class="card">
                        <h4>Payment Details</h4>
                        <p><strong>Price:</strong> 0.05 USDC per request</p>
                        <p><strong>Address:</strong> <code style="word-break: break-all;">{payment_address}</code></p>
                        <p><strong>Network:</strong> Base</p>
                    </div>
                    <div class="card">
                        <h4>Status</h4>
                        <p style="margin-top: 10px;"><em>{"Currently in FREE MODE for testing" if free_mode else "Payment verification active"}</em></p>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>Documentation</h2>
                <p style="margin-bottom: 20px;">Interactive API documentation available:</p>
                <div style="margin: 20px 0;">
                    <a href="/docs" style="display: inline-block; background: rgba(77, 182, 172, 0.2); padding: 12px 24px; border-radius: 6px; border: 1px solid #4db6ac; margin-right: 15px;">Swagger UI</a>
                    <a href="/redoc" style="display: inline-block; background: rgba(77, 182, 172, 0.2); padding: 12px 24px; border-radius: 6px; border: 1px solid #4db6ac;">ReDoc</a>
                </div>
            </div>

            <footer>
                <p><strong>Built by DeganAI</strong></p>
                <p style="margin-top: 10px; opacity: 0.7;">Bounty #10 Submission for Daydreams AI Agent Bounties</p>
            </footer>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)


@app.get("/.well-known/agent.json")
@app.head("/.well-known/agent.json")
async def agent_metadata():
    """AP2 (Agent Payments Protocol) metadata - returns HTTP 200"""
    agent_json = {
        "name": "Bridge Route Pinger",
        "description": "List viable bridge routes and live fee/time quotes for token transfers. Get real-time quotes from Socket, LI.FI, and other major bridge aggregators.",
        "url": base_url.replace("https://", "http://") + "/",
        "version": "1.0.0",
        "capabilities": {
            "streaming": False,
            "pushNotifications": False,
            "stateTransitionHistory": True,
            "extensions": [
                {
                    "uri": "https://github.com/google-agentic-commerce/ap2/tree/v0.1",
                    "description": "Agent Payments Protocol (AP2)",
                    "required": True,
                    "params": {
                        "roles": ["merchant"]
                    }
                }
            ]
        },
        "defaultInputModes": ["application/json"],
        "defaultOutputModes": ["application/json", "text/plain"],
        "skills": [
            {
                "id": "bridge-route-pinger",
                "name": "bridge-route-pinger",
                "description": "Get bridge routes and quotes for token transfers across chains",
                "inputModes": ["application/json"],
                "outputModes": ["application/json"],
                "streaming": False,
                "x_input_schema": {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "type": "object",
                    "properties": {
                        "token": {
                            "description": "Token symbol or address to bridge",
                            "type": "string"
                        },
                        "amount": {
                            "description": "Amount to transfer in token decimals",
                            "type": "string"
                        },
                        "from_chain": {
                            "description": "Source chain ID",
                            "type": "integer"
                        },
                        "to_chain": {
                            "description": "Destination chain ID",
                            "type": "integer"
                        }
                    },
                    "required": ["token", "amount", "from_chain", "to_chain"],
                    "additionalProperties": False
                },
                "x_output_schema": {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "type": "object",
                    "properties": {
                        "routes": {"type": "array"},
                        "total_routes": {"type": "integer"},
                        "best_route": {"type": "string"},
                        "timestamp": {"type": "string"}
                    },
                    "required": ["routes", "total_routes", "timestamp"],
                    "additionalProperties": False
                }
            }
        ],
        "supportsAuthenticatedExtendedCard": False,
        "entrypoints": {
            "bridge-route-pinger": {
                "description": "Get bridge routes and quotes for token transfers",
                "streaming": False,
                "input_schema": {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "type": "object",
                    "properties": {
                        "token": {"description": "Token symbol or address", "type": "string"},
                        "amount": {"description": "Amount to transfer", "type": "string"},
                        "from_chain": {"type": "integer"},
                        "to_chain": {"type": "integer"}
                    },
                    "required": ["token", "amount", "from_chain", "to_chain"],
                    "additionalProperties": False
                },
                "output_schema": {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "type": "object",
                    "properties": {
                        "routes": {"type": "array"},
                        "total_routes": {"type": "integer"},
                        "best_route": {"type": "string"}
                    },
                    "additionalProperties": False
                },
                "pricing": {
                    "invoke": "0.05 USDC"
                }
            }
        },
        "payments": [
            {
                "method": "x402",
                "payee": payment_address,
                "network": "base",
                "endpoint": "https://facilitator.daydreams.systems",
                "priceModel": {
                    "default": "0.05"
                },
                "extensions": {
                    "x402": {
                        "facilitatorUrl": "https://facilitator.daydreams.systems"
                    }
                }
            }
        ]
    }

    return JSONResponse(content=agent_json, status_code=200)


@app.get("/.well-known/x402")
@app.head("/.well-known/x402")
async def x402_metadata():
    """x402 protocol metadata for service discovery"""
    metadata = {
        "x402Version": 1,
        "accepts": [
            {
                "scheme": "exact",
                "network": "base",
                "maxAmountRequired": "50000",  # 0.05 USDC (6 decimals)
                "resource": f"{base_url}/bridge/routes",
                "description": "Get bridge routes and live fee/time quotes for token transfers across chains",
                "mimeType": "application/json",
                "payTo": payment_address,
                "maxTimeoutSeconds": 30,
                "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  # USDC on Base
            }
        ]
    }

    return JSONResponse(content=metadata, status_code=402)


@app.get("/favicon.ico")
async def favicon():
    """Favicon endpoint"""
    from fastapi.responses import Response
    svg_content = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌉</text></svg>'
    return Response(content=svg_content, media_type="image/svg+xml")


@app.get("/health")
@app.head("/health")
async def health():
    """Health check"""
    return {
        "status": "healthy",
        "service": "bridge-route-pinger",
        "version": "1.0.0",
        "free_mode": free_mode,
        "supported_aggregators": ["socket", "lifi"],
        "supported_chains": [1, 10, 56, 137, 8453, 42161, 43114, 59144, 534352, 81457]
    }


@app.post("/bridge/routes", response_model=BridgeResponse)
async def get_bridge_routes(request: BridgeRequest):
    """
    Get bridge routes and quotes for token transfers

    Aggregates bridge routes from Socket, LI.FI, and other bridge providers
    to find the best routes based on fees, speed, and reliability.
    """
    try:
        logger.info(f"Fetching bridge routes for {request.token} from chain {request.from_chain} to {request.to_chain}")

        # Fetch routes from aggregators
        routes = await bridge_aggregator.get_routes(
            token=request.token,
            amount=request.amount,
            from_chain=request.from_chain,
            to_chain=request.to_chain
        )

        if not routes:
            raise HTTPException(
                status_code=404,
                detail="No bridge routes found for the specified parameters"
            )

        # Find best route (lowest fee + fastest time)
        best_route = None
        if routes:
            # Score routes by fee (lower is better) and time (lower is better)
            def route_score(r):
                try:
                    fee = float(r.fee_usd)
                    time = r.eta_minutes
                    # Weighted score: 70% fee, 30% time (normalized to 0-1 scale)
                    # Assume max fee of $100 and max time of 1440 minutes (24 hours)
                    fee_score = min(fee / 100.0, 1.0)
                    time_score = min(time / 1440.0, 1.0)
                    return (fee_score * 0.7) + (time_score * 0.3)
                except:
                    return 999.0

            best = min(routes, key=route_score)
            best_route = best.route_id

        return BridgeResponse(
            routes=routes,
            total_routes=len(routes),
            best_route=best_route,
            timestamp=datetime.utcnow().isoformat() + "Z"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bridge route fetch error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@app.get("/entrypoints/bridge-route-pinger/invoke")
@app.head("/entrypoints/bridge-route-pinger/invoke")
async def entrypoint_bridge_get():
    """x402 discovery endpoint - returns HTTP 402"""
    metadata = {
        "x402Version": 1,
        "accepts": [
            {
                "scheme": "exact",
                "network": "base",
                "maxAmountRequired": "50000",  # 0.05 USDC (6 decimals)
                "resource": f"{base_url}/entrypoints/bridge-route-pinger/invoke",
                "description": "Get bridge routes and live fee/time quotes for token transfers",
                "mimeType": "application/json",
                "payTo": payment_address,
                "maxTimeoutSeconds": 30,
                "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  # USDC on Base
                "outputSchema": {
                    "input": {
                        "type": "http",
                        "method": "POST",
                        "bodyType": "json",
                        "bodyFields": {
                            "token": {"type": "string", "required": True, "description": "Token symbol or address to bridge"},
                            "amount": {"type": "string", "required": True, "description": "Amount to transfer in token decimals"},
                            "from_chain": {"type": "number", "required": True, "description": "Source chain ID"},
                            "to_chain": {"type": "number", "required": True, "description": "Destination chain ID"}
                        }
                    },
                    "output": {"type": "object", "description": "Bridge routes with live fee and time quotes"}
                }
            }
        ]
    }
    return JSONResponse(content=metadata, status_code=402)


@app.post(
    "/entrypoints/bridge-route-pinger/invoke",
    summary="Cross-Chain Bridge Route Finder",
    description="Find optimal bridge routes with live fees and timing across 10+ chains. Aggregates Socket and LI.FI to provide best cross-chain bridging options with accurate fee estimates and transfer times.",
    response_description="Available bridge routes with fees and ETAs"
)
async def entrypoint_bridge(request: BridgeRequest):
    """
    AP2 (Agent Payments Protocol) compatible entrypoint

    Calls the main /bridge/routes endpoint with the same logic.
    """
    return await get_bridge_routes(request)


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
