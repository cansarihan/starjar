#!/usr/bin/env bash
# Build and deploy the tip jar.
#
#   ./scripts/deploy.sh testnet starjar-admin
#   ./scripts/deploy.sh mainnet starjar-admin
#
# The second argument is a stellar-cli identity (`stellar keys ls`). It pays for
# the deploy and becomes the contract admin. XLM and Circle's USDC are allowed
# from the start; more tokens can be added later with `set_token`.
set -euo pipefail

network="${1:-}"
source="${2:-}"
if [ -z "$network" ] || [ -z "$source" ]; then
  echo "usage: ./scripts/deploy.sh <testnet|mainnet> <identity>" >&2
  exit 1
fi

case "$network" in
  testnet) usdc_issuer="GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" ;;
  mainnet) usdc_issuer="GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" ;;
  *) echo "unknown network: $network" >&2; exit 1 ;;
esac

if [ "$network" = "mainnet" ]; then
  read -r -p "Deploy to MAINNET as '$source'? This spends real XLM. [y/N] " ok
  [ "$ok" = "y" ] || exit 1
fi

cd "$(dirname "$0")/.."

stellar contract build --package starjar-tipjar
wasm=target/wasm32v1-none/release/starjar_tipjar.wasm

admin=$(stellar keys address "$source")
xlm=$(stellar contract id asset --asset native --network "$network")
usdc=$(stellar contract id asset --asset "USDC:$usdc_issuer" --network "$network")

# A SAC has to exist before the contract can call it. Deploying one that is
# already there fails harmlessly.
stellar contract asset deploy --asset "USDC:$usdc_issuer" --source "$source" --network "$network" 2>/dev/null || true

id=$(stellar contract deploy \
  --wasm "$wasm" \
  --source "$source" \
  --network "$network" \
  --alias "starjar-$network" \
  -- \
  --admin "$admin" \
  --tokens "[\"$xlm\",\"$usdc\"]")

echo
echo "network      $network"
echo "contract     $id"
echo "admin        $admin"
echo "xlm sac      $xlm"
echo "usdc sac     $usdc"
echo
echo "Put these in .env.local:"
echo "PUBLIC_STELLAR_NETWORK=$network"
echo "PUBLIC_TIPJAR_CONTRACT_ID=$id"
echo "PUBLIC_XLM_SAC=$xlm"
echo "PUBLIC_USDC_SAC=$usdc"
