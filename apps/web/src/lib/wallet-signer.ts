/**
 * Wallet Signer — sign challenge nonces with Secp256k1 for auth.
 */

import { Secp256k1, Sha256, Slip10, Slip10Curve, stringToPath } from '@cosmjs/crypto'
import { toHex } from '@cosmjs/encoding'
import { Bip39 } from '@cosmjs/crypto'
import { AXIOME_HD_PATH } from '@checkers/shared/chain'

/**
 * Sign a challenge string with the wallet derived from mnemonic.
 * Returns { signature, pubkey } as hex strings.
 */
export async function signChallenge(
  mnemonic: string,
  challenge: string,
): Promise<{ signature: string; pubkey: string }> {
  // Derive private key from mnemonic via BIP-44 HD path
  const seed = await Bip39.mnemonicToSeed(new (await import('@cosmjs/crypto')).EnglishMnemonic(mnemonic.trim()))
  const { privkey } = Slip10.derivePath(Slip10Curve.Secp256k1, seed, stringToPath(AXIOME_HD_PATH))
  const { pubkey } = await Secp256k1.makeKeypair(privkey)
  const compressedPubkey = Secp256k1.compressPubkey(pubkey)

  // Sign SHA256(challenge)
  const messageHash = new Sha256(new TextEncoder().encode(challenge)).digest()
  const signatureObj = await Secp256k1.createSignature(messageHash, privkey)
  // toFixedLength() returns 65 bytes (r:32 + s:32 + recovery:1), strip recovery byte
  const signatureBytes = signatureObj.toFixedLength().slice(0, 64)

  return {
    signature: toHex(signatureBytes),
    pubkey: toHex(compressedPubkey),
  }
}
