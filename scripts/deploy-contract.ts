/**
 * Deploy checkers-vault contract to Axiome chain.
 *
 * Usage:
 *   RELAYER_MNEMONIC="..." npx tsx scripts/deploy-contract.ts
 *
 * Steps:
 *   1. Upload WASM code
 *   2. Instantiate contract with config
 *   3. Print contract address
 */

import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { GasPrice } from '@cosmjs/stargate'
import { Slip10RawIndex } from '@cosmjs/crypto'
import * as fs from 'fs'
import * as path from 'path'

const RPC = process.env.RPC || 'http://49.13.3.227:26657'
const PREFIX = 'axm'
const GAS_PRICE_STR = '0.025uaxm'
const DENOM = 'uaxm'

// Axiome HD path: m/44'/546'/0'/0/0
const AXIOME_HD_PATH = [
  Slip10RawIndex.hardened(44),
  Slip10RawIndex.hardened(546),
  Slip10RawIndex.hardened(0),
  Slip10RawIndex.normal(0),
  Slip10RawIndex.normal(0),
]

// Contract config
const TREASURY = process.env.TREASURY || 'axm1g2akr2kxul2kpummprad7luhue6hpd9u48jaud'
const COMMISSION_BPS = 1000 // 10%
const MIN_WAGER = '1000000' // 1 AXM
const RESOLVE_TIMEOUT_SECS = 7200 // 2 hours

async function main() {
  const mnemonic = process.env.RELAYER_MNEMONIC
  if (!mnemonic) {
    console.error('Set RELAYER_MNEMONIC env var')
    process.exit(1)
  }

  // Create wallet
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: PREFIX,
    hdPaths: [AXIOME_HD_PATH],
  })
  const [account] = await wallet.getAccounts()
  console.log(`Deployer: ${account.address}`)

  // Connect signing client
  const client = await SigningCosmWasmClient.connectWithSigner(RPC, wallet, {
    gasPrice: GasPrice.fromString(GAS_PRICE_STR),
  })

  const balance = await client.getBalance(account.address, DENOM)
  console.log(`Balance: ${balance.amount} ${balance.denom}`)

  // Upload WASM
  const wasmPath = path.resolve(__dirname, '../contracts/checkers-vault/artifacts/checkers_vault.wasm')
  if (!fs.existsSync(wasmPath)) {
    console.error(`WASM not found: ${wasmPath}`)
    console.error('Build first: cd contracts/checkers-vault && cargo build --release --target wasm32-unknown-unknown')
    process.exit(1)
  }

  const wasmCode = fs.readFileSync(wasmPath)
  console.log(`WASM size: ${(wasmCode.length / 1024).toFixed(1)} KB`)
  console.log('Uploading...')

  const uploadResult = await client.upload(account.address, wasmCode, 'auto')
  console.log(`Code ID: ${uploadResult.codeId}`)
  console.log(`Upload TX: ${uploadResult.transactionHash}`)

  // Instantiate
  console.log('Instantiating...')
  const instantiateMsg = {
    treasury: TREASURY,
    denom: DENOM,
    commission_bps: COMMISSION_BPS,
    min_wager: MIN_WAGER,
    resolve_timeout_secs: RESOLVE_TIMEOUT_SECS,
  }

  const instantiateResult = await client.instantiate(
    account.address,
    uploadResult.codeId,
    instantiateMsg,
    'Checkers Vault',
    'auto',
    { admin: account.address },
  )

  console.log('')
  console.log('=== CONTRACT DEPLOYED ===')
  console.log(`Contract: ${instantiateResult.contractAddress}`)
  console.log(`TX: ${instantiateResult.transactionHash}`)
  console.log(`Code ID: ${uploadResult.codeId}`)
  console.log('')
  console.log('Set this env var in Railway:')
  console.log(`  CHECKERS_CONTRACT=${instantiateResult.contractAddress}`)

  client.disconnect()
}

main().catch(console.error)
