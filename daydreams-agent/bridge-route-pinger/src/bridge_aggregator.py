"""
Bridge Aggregator - Aggregate routes from multiple bridge providers

Combines results from Socket, LI.FI, and other bridge APIs
"""
import logging
from typing import List, Optional
import asyncio
from pydantic import BaseModel, Field

from src.socket_client import SocketClient
from src.lifi_client import LifiClient

logger = logging.getLogger(__name__)


# Chain ID to name mapping
CHAIN_NAMES = {
    1: "Ethereum",
    10: "Optimism",
    56: "BSC",
    137: "Polygon",
    8453: "Base",
    42161: "Arbitrum",
    43114: "Avalanche",
    59144: "Linea",
    534352: "Scroll",
    81457: "Blast",
}

# Common token addresses by chain
TOKEN_ADDRESSES = {
    "USDC": {
        1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
        56: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
        137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
        8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        43114: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    },
    "USDT": {
        1: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        10: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
        56: "0x55d398326f99059fF775485246999027B3197955",
        137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        43114: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
    },
    "ETH": {
        1: "0x0000000000000000000000000000000000000000",
        10: "0x0000000000000000000000000000000000000000",
        8453: "0x0000000000000000000000000000000000000000",
        42161: "0x0000000000000000000000000000000000000000",
    },
    "WETH": {
        1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        10: "0x4200000000000000000000000000000000000006",
        8453: "0x4200000000000000000000000000000000000006",
        42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    },
}


class BridgeRoute(BaseModel):
    """Represents a bridge route option"""
    bridge_name: str
    route_id: str
    from_chain: int
    to_chain: int
    token_in: str
    token_out: str
    amount_in: str
    amount_out: str
    fee_usd: str = Field(description="Fee in USD")
    eta_minutes: int = Field(description="Estimated time in minutes")
    requirements: List[str] = Field(description="Additional requirements (gas tokens, etc.)")
    steps: List[str] = Field(description="Step-by-step description")
    source: str = Field(description="API source (socket_api, lifi_api, etc.)")


class BridgeAggregator:
    """Aggregates bridge routes from multiple providers"""

    def __init__(self):
        self.socket_client = SocketClient()
        self.lifi_client = LifiClient()
        logger.info("Bridge aggregator initialized")

    def _resolve_token_address(self, token: str, chain_id: int) -> Optional[str]:
        """Resolve token symbol to address for a given chain"""
        token_upper = token.upper()

        # Check if it's already an address
        if token.startswith("0x") and len(token) == 42:
            return token

        # Try to find in our mapping
        if token_upper in TOKEN_ADDRESSES:
            return TOKEN_ADDRESSES[token_upper].get(chain_id)

        return None

    async def get_routes(
        self, token: str, amount: str, from_chain: int, to_chain: int
    ) -> List[BridgeRoute]:
        """
        Get bridge routes from all aggregators

        Args:
            token: Token symbol or address
            amount: Amount in token decimals
            from_chain: Source chain ID
            to_chain: Destination chain ID

        Returns:
            List of BridgeRoute objects
        """
        all_routes = []

        # Resolve token addresses
        from_token = self._resolve_token_address(token, from_chain)
        to_token = self._resolve_token_address(token, to_chain)

        if not from_token:
            logger.warning(
                f"Could not resolve token {token} on chain {from_chain}, using symbol"
            )
            from_token = token

        if not to_token:
            logger.warning(
                f"Could not resolve token {token} on chain {to_chain}, using symbol"
            )
            to_token = token

        # Fetch routes from all providers in parallel
        tasks = [
            self.socket_client.get_routes(from_token, amount, from_chain, to_chain),
            self.lifi_client.get_routes(from_token, to_token, amount, from_chain, to_chain),
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Combine results
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Error fetching routes: {result}")
                continue
            if result:
                all_routes.extend(result)

        logger.info(f"Found {len(all_routes)} total routes")
        return all_routes

    def get_chain_name(self, chain_id: int) -> str:
        """Get chain name from ID"""
        return CHAIN_NAMES.get(chain_id, f"Chain {chain_id}")
