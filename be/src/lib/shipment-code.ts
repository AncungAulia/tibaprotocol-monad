/**
 * 6-character shipment code shown under the carrier's QR (fallback when a scanner is not available).
 *
 * Layout: 5 Crockford base32 characters carrying a scrambled 25-bit shipment id, followed by one
 * checksum character. Scrambling (multiplying by an odd constant modulo 2^25) keeps consecutive
 * shipments from getting look-alike codes. The checksum uses odd weights, so any single mistyped
 * character is always detected.
 *
 * Supports shipment ids 0 .. 33,554,431.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const BITS = 25
const MODULUS = 1n << BigInt(BITS)
const MASK = MODULUS - 1n
/** Odd multiplier and its inverse modulo 2^25. */
const MULTIPLIER = 0x1b873593n & MASK
const WEIGHTS = [1, 3, 5, 7, 9] as const

export const MAX_SHIPMENT_ID = Number(MASK)
export const SHIPMENT_CODE_LENGTH = 6

function modInverse(a: bigint, m: bigint): bigint {
  // Extended Euclid; a is odd and m is a power of two, so the inverse exists.
  let [oldR, r] = [a, m]
  let [oldS, s] = [1n, 0n]
  while (r !== 0n) {
    const q = oldR / r
    ;[oldR, r] = [r, oldR - q * r]
    ;[oldS, s] = [s, oldS - q * s]
  }
  return ((oldS % m) + m) % m
}

const INVERSE = modInverse(MULTIPLIER, MODULUS)

function checksum(values: readonly number[]): number {
  let sum = 0
  values.forEach((value, i) => {
    sum += value * WEIGHTS[i]!
  })
  return sum % 32
}

/** Encodes a shipment id into its 6-character code. */
export function encodeShipmentCode(id: bigint | number): string {
  const n = BigInt(id)
  if (n < 0n || n > MASK) throw new RangeError(`Shipment id ${id} is out of range for a code`)

  let scrambled = (n * MULTIPLIER) & MASK
  const values: number[] = []
  for (let i = 0; i < 5; i++) {
    values.unshift(Number(scrambled & 31n))
    scrambled >>= 5n
  }
  return [...values, checksum(values)].map((v) => ALPHABET[v]).join("")
}

/** Normalises user input: uppercase, strips spaces and dashes, maps look-alike letters. */
export function normalizeShipmentCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
}

/** Decodes a code back to the shipment id. Returns null when the code is malformed or mistyped. */
export function decodeShipmentCode(input: string): bigint | null {
  const code = normalizeShipmentCode(input)
  if (code.length !== SHIPMENT_CODE_LENGTH) return null

  const values: number[] = []
  for (const char of code) {
    const value = ALPHABET.indexOf(char)
    if (value < 0) return null
    values.push(value)
  }

  const body = values.slice(0, 5)
  if (checksum(body) !== values[5]) return null

  const scrambled = body.reduce((acc, v) => (acc << 5n) | BigInt(v), 0n)
  return (scrambled * INVERSE) & MASK
}
