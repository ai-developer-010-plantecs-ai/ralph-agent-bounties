"""
Minimal x402-compliant seller service for AI agent micropayments.

This service demonstrates the x402 payment flow where AI agents pay
for access to resources using the HTTP 402 Payment Required protocol.
"""

import os
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs

# x402 configuration
X402_FACILITATOR = os.environ.get("X402_FACILITATOR", "https://facilitator.x402.org")
X402_PRICE_CENTS = int(os.environ.get("X402_PRICE_CENTS", "1"))  # 1 cent per request
X402_TOKEN = os.environ.get("X402_TOKEN", "USDC")
X402_CHAIN = os.environ.get("X402_CHAIN", "base-sepolia")

# Service data
SERVICE_DATA = {
    "message": "Welcome to x402-enabled service!",
    "timestamp": "2025-04-05T12:00:00Z",
    "data": "This content is paid for via x402 micropayments."
}


class X402Handler(BaseHTTPRequestHandler):
    """HTTP handler implementing x402 Payment Required protocol."""
    
    def log_message(self, format, *args):
        """Custom logging."""
        print(f"[x402-seller] {args[0]}")
    
    def send_payment_required(self):
        """Send HTTP 402 with x402 payment headers."""
        self.send_response(402)
        self.send_header("Content-Type", "application/json")
        
        # x402 payment headers
        payment_info = {
            "price": str(X402_PRICE_CENTS),
            "token": X402_TOKEN,
            "chain": X402_CHAIN,
            "facilitator": X402_FACILITATOR,
            "recipient": os.environ.get("X402_RECIPIENT", "0x0")
        }
        
        self.send_header("PAYMENT-REQUIRED", json.dumps(payment_info))
        self.end_headers()
        self.wfile.write(json.dumps({"error": "Payment required"}).encode())
    
    def do_GET(self):
        """Handle GET requests."""
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == "/":
            # Root endpoint - requires payment
            self.send_payment_required()
            
        elif parsed_path.path == "/api/data":
            # Data endpoint - requires payment
            self.send_payment_required()
            
        elif parsed_path.path == "/health":
            # Health check - no payment required
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "healthy"}).encode())
            
        else:
            # Unknown endpoint
            self.send_response(404)
            self.end_headers()


def run_server(port=8080):
    """Run the x402 seller server."""
    server_address = ("", port)
    httpd = HTTPServer(server_address, X402Handler)
    print(f"[x402-seller] Server starting on port {port}")
    print(f"[x402-seller] Price: {X402_PRICE_CENTS} {X402_TOKEN} per request")
    print(f"[x402-seller] Chain: {X402_CHAIN}")
    httpd.serve_forever()


if __name__ == "__main__":
    run_server()
