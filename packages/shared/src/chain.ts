// Axiome Chain configuration
// Shared between API and frontend

export const AXIOME_PREFIX = 'axm'
export const AXIOME_COIN_TYPE = 546
export const AXIOME_HD_PATH = "m/44'/546'/0'/0/0"
export const AXIOME_CHAIN_ID = 'axiome-1'
export const AXIOME_DENOM = 'uaxm'
export const AXIOME_DISPLAY_DENOM = 'AXM'
export const AXIOME_DECIMALS = 6

export const AXIOME_RPC = 'http://49.13.3.227:26657'
export const AXIOME_REST = 'http://49.13.3.227:1317'

export const AXIOME_GAS_PRICE = '0.025uaxm'

export function getAxiomeChainConfig() {
  return {
    chainId: AXIOME_CHAIN_ID,
    chainName: 'Axiome',
    rpc: AXIOME_RPC,
    rest: AXIOME_REST,
    bip44: { coinType: AXIOME_COIN_TYPE },
    bech32Config: {
      bech32PrefixAccAddr: AXIOME_PREFIX,
      bech32PrefixAccPub: `${AXIOME_PREFIX}pub`,
      bech32PrefixValAddr: `${AXIOME_PREFIX}valoper`,
      bech32PrefixValPub: `${AXIOME_PREFIX}valoperpub`,
      bech32PrefixConsAddr: `${AXIOME_PREFIX}valcons`,
      bech32PrefixConsPub: `${AXIOME_PREFIX}valconspub`,
    },
    currencies: [
      { coinDenom: AXIOME_DISPLAY_DENOM, coinMinimalDenom: AXIOME_DENOM, coinDecimals: AXIOME_DECIMALS },
    ],
    feeCurrencies: [
      { coinDenom: AXIOME_DISPLAY_DENOM, coinMinimalDenom: AXIOME_DENOM, coinDecimals: AXIOME_DECIMALS, gasPriceStep: { low: 0.025, average: 0.05, high: 0.1 } },
    ],
    stakeCurrency: {
      coinDenom: AXIOME_DISPLAY_DENOM, coinMinimalDenom: AXIOME_DENOM, coinDecimals: AXIOME_DECIMALS,
    },
  }
}
