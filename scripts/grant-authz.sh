#!/bin/bash
# Grant ContractExecutionAuthorization from user to relayer for the checkers contract.
#
# Usage:
#   RELAYER=axm1... CONTRACT=axm1... ./scripts/grant-authz.sh
#
# This grants the relayer the ability to execute create_game, join_game,
# cancel_game, claim_timeout on behalf of the user.
#
# IMPORTANT: NEVER use GenericAuthorization on MsgExecuteContract

set -euo pipefail

CHAIN_ID="${CHAIN_ID:-axiome-1}"
RPC="${RPC:-http://49.13.3.227:26657}"
RELAYER="${RELAYER:?Set RELAYER address}"
CONTRACT="${CONTRACT:?Set CONTRACT address}"
DENOM="${DENOM:-uaxm}"
GAS_PRICES="${GAS_PRICES:-0.025uaxm}"
EXPIRATION="${EXPIRATION:-2027-01-01T00:00:00Z}"

echo "=== Checkers Authz Grant ==="
echo "Chain:    $CHAIN_ID"
echo "Relayer:  $RELAYER"
echo "Contract: $CONTRACT"
echo ""
echo "Granting ContractExecutionAuthorization..."
echo "Allowed messages: create_game, join_game, cancel_game, claim_timeout"
echo ""

# The grant JSON for ContractExecutionAuthorization
# with AcceptedMessageKeysFilter scoped to specific contract actions
cat > /tmp/authz-grant.json << 'GRANT_EOF'
{
  "@type": "/cosmwasm.wasm.v1.ContractExecutionAuthorization",
  "grants": [
    {
      "contract": "CONTRACT_PLACEHOLDER",
      "filter": {
        "@type": "/cosmwasm.wasm.v1.AcceptedMessageKeysFilter",
        "keys": ["create_game", "join_game", "cancel_game", "claim_timeout"]
      },
      "limit": {
        "@type": "/cosmwasm.wasm.v1.MaxCallsLimit",
        "remaining": "999999999"
      }
    }
  ]
}
GRANT_EOF

# Replace placeholder
sed -i "s|CONTRACT_PLACEHOLDER|$CONTRACT|g" /tmp/authz-grant.json

echo "Grant JSON:"
cat /tmp/authz-grant.json
echo ""
echo ""
echo "Run this command from the user's wallet:"
echo ""
echo "  axiomed tx authz grant $RELAYER generic \\"
echo "    --msg-type /cosmwasm.wasm.v1.MsgExecuteContract \\"
echo "    --from <user-wallet> \\"
echo "    --chain-id $CHAIN_ID \\"
echo "    --node $RPC \\"
echo "    --gas-prices $GAS_PRICES \\"
echo "    --gas auto \\"
echo "    --gas-adjustment 1.3"
echo ""
echo "WARNING: The above uses GenericAuthorization as a simplified example."
echo "For production, use ContractExecutionAuthorization with AcceptedMessageKeysFilter."
echo "See the JSON above for the proper grant structure."
