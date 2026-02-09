"""
Socket API Client - Bridge route aggregator integration

Socket Protocol: https://docs.socket.tech/
"""
import logging
from typing import List, Optional, Dict, Any
import httpx

logger = logging.getLogger(__name__)


class SocketClient:
    """Client for Socket bridge API"""

    BASE_URL = "https://api.socket.tech/v2"
    API_KEY = "72a5b4b0-e727-48be-8aa1-5da9d62fe635"  # Public demo key

    # Chain ID mapping (Socket uses different IDs for some chains)
    CHAIN_MAP = {
        1: 1,  # Ethereum
        10: 10,  # Optimism
        56: 56,  # BSC
        137: 137,  # Polygon
        8453: 8453,  # Base
        42161: 42161,  # Arbitrum
        43114: 43114,  # Avalanche
        59144: 59144,  # Linea
        534352: 534352,  # Scroll
        81457: 81457,  # Blast
    }

    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)

    async def get_routes(
        self, from_token: str, amount: str, from_chain: int, to_chain: int
    ) -> List[Any]:
        """
        Get bridge routes from Socket API

        Args:
            from_token: Token address on source chain
            amount: Amount in token decimals
            from_chain: Source chain ID
            to_chain: Destination chain ID

        Returns:
            List of BridgeRoute objects
        """
        try:
            # Map chain IDs
            socket_from_chain = self.CHAIN_MAP.get(from_chain, from_chain)
            socket_to_chain = self.CHAIN_MAP.get(to_chain, to_chain)

            # Build request
            url = f"{self.BASE_URL}/quote"
            params = {
                "fromChainId": socket_from_chain,
                "toChainId": socket_to_chain,
                "fromTokenAddress": from_token,
                "toTokenAddress": from_token,  # Assume same token on destination
                "fromAmount": amount,
                "userAddress": "0x0000000000000000000000000000000000000000",  # Placeholder
                "sort": "output",  # Sort by output amount
                "singleTxOnly": "false",
            }

            headers = {
                "API-KEY": self.API_KEY,
                "Accept": "application/json",
            }

            logger.info(f"Socket API request: {url} with params: {params}")

            response = await self.client.get(url, params=params, headers=headers)

            if response.status_code == 200:
                data = response.json()
                return self._parse_routes(data, from_chain, to_chain, from_token)
            else:
                logger.warning(
                    f"Socket API returned status {response.status_code}: {response.text}"
                )
                return []

        except Exception as e:
            logger.error(f"Socket API error: {e}", exc_info=True)
            return []

    def _parse_routes(
        self, data: Dict[str, Any], from_chain: int, to_chain: int, token: str
    ) -> List[Any]:
        """Parse Socket API response into BridgeRoute objects"""
        from src.bridge_aggregator import BridgeRoute

        routes = []

        try:
            # Socket returns a list of routes
            raw_routes = data.get("result", {}).get("routes", [])

            for idx, route in enumerate(raw_routes):
                try:
                    # Extract route details
                    route_id = route.get("routeId", f"socket-{idx}")
                    from_amount = route.get("fromAmount", "0")
                    to_amount = route.get("toAmount", "0")

                    # Calculate fee
                    total_gas_fees_usd = float(
                        route.get("totalGasFeesInUsd", 0) or 0
                    )
                    service_fees_usd = 0  # Socket doesn't always provide service fee separately

                    # Get protocol info
                    user_txs = route.get("userTxs", [])
                    bridge_name = "Unknown"
                    steps = []

                    if user_txs:
                        # Get first step protocol
                        first_step = user_txs[0].get("steps", [])[0] if user_txs[0].get("steps") else {}
                        protocol_info = first_step.get("protocol", {})
                        bridge_name = protocol_info.get("displayName", "Socket Bridge")

                        # Build step descriptions
                        for tx in user_txs:
                            for step in tx.get("steps", []):
                                protocol = step.get("protocol", {}).get("displayName", "Unknown")
                                action = step.get("action", {}).get("name", "transfer")
                                steps.append(f"{action.capitalize()} via {protocol}")

                    # Estimate time (Socket provides servicetime in seconds)
                    service_time = route.get("serviceTime", 300)  # Default 5 minutes
                    eta_minutes = max(1, service_time // 60)

                    # Build requirements
                    requirements = []
                    from_chain_name = self._get_chain_name(from_chain)
                    to_chain_name = self._get_chain_name(to_chain)

                    if total_gas_fees_usd > 0:
                        requirements.append(
                            f"Gas fees on {from_chain_name} (~${total_gas_fees_usd:.2f})"
                        )

                    # Create route object
                    bridge_route = BridgeRoute(
                        bridge_name=bridge_name,
                        route_id=route_id,
                        from_chain=from_chain,
                        to_chain=to_chain,
                        token_in=self._format_token(token),
                        token_out=self._format_token(token),
                        amount_in=from_amount,
                        amount_out=to_amount,
                        fee_usd=f"{total_gas_fees_usd:.2f}",
                        eta_minutes=eta_minutes,
                        requirements=requirements or ["Gas tokens on source chain"],
                        steps=steps or ["Bridge tokens"],
                        source="socket_api",
                    )

                    routes.append(bridge_route)

                except Exception as e:
                    logger.error(f"Error parsing Socket route: {e}")
                    continue

            logger.info(f"Parsed {len(routes)} routes from Socket")

        except Exception as e:
            logger.error(f"Error parsing Socket response: {e}")

        return routes

    def _get_chain_name(self, chain_id: int) -> str:
        """Get chain name from ID"""
        chain_names = {
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
        return chain_names.get(chain_id, f"Chain {chain_id}")

    def _format_token(self, address: str) -> str:
        """Format token address to symbol if known"""
        # Common token addresses to symbols
        token_map = {
            "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": "USDC",
            "0xdAC17F958D2ee523a2206206994597C13D831ec7": "USDT",
            "0x0000000000000000000000000000000000000000": "ETH",
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": "WETH",
        }

        # Check if exact match
        if address in token_map:
            return token_map[address]

        # Check case-insensitive
        for addr, symbol in token_map.items():
            if addr.lower() == address.lower():
                return symbol

        # Return last 6 chars of address if unknown
        if address.startswith("0x") and len(address) == 42:
            return f"Token ...{address[-6:]}"

        return address

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()
