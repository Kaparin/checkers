/**
 * Instantiate checkers-vault contract from existing code ID.
 *
 * Usage:
 *   RELAYER_MNEMONIC="..." CODE_ID=42 npx tsx scripts/instantiate-contract.ts
 */

import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { GasPrice } from '@cosmjs/stargate'
import { Slip10RawIndex } from '@cosmjs/crypto'

const RPC = process.env.RPC || 'http://49.13.3.227:26657'
const PREFIX = 'axm'
const GAS_PRICE_STR = '0.025uaxm'
const DENOM = 'uaxm'
const CODE_ID = Number(process.env.CODE_ID || '42')

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

  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: PREFIX,
    hdPaths: [AXIOME_HD_PATH],
  })
  const [account] = await wallet.getAccounts()
  console.log(`Deployer: ${account.address}`)

  const client = await SigningCosmWasmClient.connectWithSigner(RPC, wallet, {
    gasPrice: GasPrice.fromString(GAS_PRICE_STR),
  })

  const balance = await client.getBalance(account.address, DENOM)
  console.log(`Balance: ${balance.amount} ${balance.denom}`)
  console.log(`Code ID: ${CODE_ID}`)

  // Instantiate
  console.log('Instantiating...')
  const instantiateMsg = {
    treasury: TREASURY,
    denom: DENOM,
    commission_bps: COMMISSION_BPS,
    min_wager: MIN_WAGER,
    resolve_timeout_secs: RESOLVE_TIMEOUT_SECS,
  }
  console.log('Msg:', JSON.stringify(instantiateMsg))

  try {
    const result = await client.instantiate(
      account.address,
      CODE_ID,
      instantiateMsg,
      'Checkers Vault',
      'auto',
      { admin: account.address },
    )

    console.log('')
    console.log('=== CONTRACT DEPLOYED ===')
    console.log(`Contract: ${result.contractAddress}`)
    console.log(`TX: ${result.transactionHash}`)
    console.log(`Code ID: ${CODE_ID}`)
    console.log('')
    console.log('Set this env var in Railway:')
    console.log(`  CHECKERS_CONTRACT=${result.contractAddress}`)
  } catch (err: any) {
    if (err.txId) {
      console.log(`TX submitted: ${err.txId}`)
      console.log('Polling for result...')
      // Wait and retry polling
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 10_000))
        try {
          const tx = await client.getTx(err.txId)
          if (tx) {
            console.log(`TX found! Code: ${tx.code}`)
            if (tx.code === 0) {
              // Find contract address from events
              for (const event of tx.events) {
                for (const attr of event.attributes) {
                  if (attr.key === '_contract_address' || attr.key === 'contract_address') {
                    console.log('')
                    console.log('=== CONTRACT DEPLOYED ===')
                    console.log(`Contract: ${attr.value}`)
                    console.log(`TX: ${err.txId}`)
                    console.log(`Code ID: ${CODE_ID}`)
                    console.log('')
                    console.log('Set this env var in Railway:')
                    console.log(`  CHECKERS_CONTRACT=${attr.value}`)
                    client.disconnect()
                    return
                  }
                }
              }
              console.log('TX succeeded but contract address not found in events')
              console.log('Events:', JSON.stringify(tx.events, null, 2))
            } else {
              console.log('TX failed:', tx.rawLog)
            }
            client.disconnect()
            return
          }
        } catch {
          // not found yet
        }
        console.log(`  Waiting... (${(i + 1) * 10}s)`)
      }
      console.log('TX still not found after 120s. Check manually.')
    } else {
      throw err
    }
  }

  client.disconnect()
}

main().catch(console.error)
