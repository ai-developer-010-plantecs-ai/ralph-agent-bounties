"""
LI.FI API Client - Bridge and DEX aggregator integration

LI.FI Protocol: https://docs.li.fi/
"""
import logging
from typing import List, Optional, Dict, Any
import httpx

logger = logging.getLogger(__name__)


class LifiClient:
    """Client for LI.FI bridge aggregation API"""

    BASE_URL = "https://li.quest/v1"

    # Chain ID mapping (LI.FI uses standard chain IDs)
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
        self,
        from_token: str,
        to_token: str,
        amount: str,
        from_chain: int,
        to_chain: int,
    ) -> List[Any]:
        """
        Get bridge routes from LI.FI API

        Args:
            from_token: Token address on source chain
            to_token: Token address on destination chain
            amount: Amount in token decimals
            from_chain: Source chain ID
            to_chain: Destination chain ID

        Returns:
            List of BridgeRoute objects
        """
        try:
            # Map chain IDs
            lifi_from_chain = self.CHAIN_MAP.get(from_chain, from_chain)
            lifi_to_chain = self.CHAIN_MAP.get(to_chain, to_chain)

            # Build request
            url = f"{self.BASE_URL}/advanced/routes"
            payload = {
                "fromChainId": lifi_from_chain,
                "toChainId": lifi_to_chain,
                "fromTokenAddress": from_token,
                "toTokenAddress": to_token,
                "fromAmount": amount,
                "options": {
                    "slippage": 0.03,  # 3% slippage
                    "order": "RECOMMENDED",  # Sort by recommended (fee + time optimized)
                },
            }

            headers = {
                "Accept": "application/json",
                "Content-Type": "application/json",
            }

            logger.info(f"LI.FI API request: {url} with payload: {payload}")

            response = await self.client.post(url, json=payload, headers=headers)

            if response.status_code == 200:
                data = response.json()
                return self._parse_routes(data, from_chain, to_chain, from_token)
            else:
                logger.warning(
                    f"LI.FI API returned status {response.status_code}: {response.text}"
                )
                return []

        except Exception as e:
            logger.error(f"LI.FI API error: {e}", exc_info=True)
            return []

    def _parse_routes(
        self, data: Dict[str, Any], from_chain: int, to_chain: int, token: str
    ) -> List[Any]:
        """Parse LI.FI API response into BridgeRoute objects"""
        from src.bridge_aggregator import BridgeRoute

        routes = []

        try:
            # LI.FI returns a list of routes
            raw_routes = data.get("routes", [])

            for idx, route in enumerate(raw_routes):
                try:
                    # Extract route details
                    route_id = route.get("id", f"lifi-{idx}")
                    from_amount = route.get("fromAmount", "0")
                    to_amount = route.get("toAmount", "0")

                    # Calculate fees
                    gas_cost_usd = 0
                    steps = route.get("steps", [])

                    bridge_names = []
                    step_descriptions = []

                    for step in steps:
                        # Get gas cost
                        estimate = step.get("estimate", {})
                        gas_costs = estimate.get("gasCosts", [])
                        for gas_cost in gas_costs:
                            gas_cost_usd += float(gas_cost.get("amountUSD", 0) or 0)

                        # Get tool info (bridge or DEX)
                        tool = step.get("tool", "Unknown")
                        tool_details = step.get("toolDetails", {})
                        tool_name = tool_details.get("name", tool)

                        if tool_name not in bridge_names:
                            bridge_names.append(tool_name)

                        # Get action type
                        action = step.get("type", "swap")  # swap, cross, custom
                        if action == "cross":
                            step_descriptions.append(f"Bridge via {tool_name}")
                        elif action == "swap":
                            step_descriptions.append(f"Swap via {tool_name}")
                        else:
                            step_descriptions.append(f"Transfer via {tool_name}")

                    # Use first bridge name or "Multi-Step"
                    bridge_name = bridge_names[0] if bridge_names else "LI.FI Route"
                    if len(bridge_names) > 1:
                        bridge_name = f"{bridge_names[0]} + {len(bridge_names) - 1} more"

                    # Get execution time
                    execution_time = route.get("estimate", {}).get(
                        "executionDuration", 300
                    )  # Default 5 min
                    eta_minutes = max(1, execution_time // 60)

                    # Calculate total fee
                    # LI.FI includes fees in the amount difference
                    try:
                        from_amt = float(from_amount)
                        to_amt = float(to_amount)
                        # Fee is gas cost (other fees are in amount diff)
                        total_fee_usd = gas_cost_usd
                    except:
                        total_fee_usd = gas_cost_usd

                    # Build requirements
                    requirements = []
                    from_chain_name = self._get_chain_name(from_chain)
                    to_chain_name = self._get_chain_name(to_chain)

                    if gas_cost_usd > 0:
                        requirements.append(
                            f"Gas fees on {from_chain_name} (~${gas_cost_usd:.2f})"
                        )
                    else:
                        requirements.append(f"Gas tokens on {from_chain_name}")

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
                        fee_usd=f"{total_fee_usd:.2f}",
                        eta_minutes=eta_minutes,
                        requirements=requirements,
                        steps=step_descriptions or ["Bridge tokens"],
                        source="lifi_api",
                    )

                    routes.append(bridge_route)

                except Exception as e:
                    logger.error(f"Error parsing LI.FI route: {e}")
                    continue

            logger.info(f"Parsed {len(routes)} routes from LI.FI")

        except Exception as e:
            logger.error(f"Error parsing LI.FI response: {e}")

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
