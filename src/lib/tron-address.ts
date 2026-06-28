import { createHash } from "node:crypto";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const TRON_PREFIX = 0x41;

export function isTronAddress(address: string): boolean {
  const decoded = decodeBase58(address);
  if (!decoded || decoded.length !== 25 || decoded[0] !== TRON_PREFIX) {
    return false;
  }

  const payload = decoded.subarray(0, 21);
  const checksum = decoded.subarray(21);
  const expectedChecksum = sha256(sha256(payload)).subarray(0, 4);

  return checksum.every((byte, index) => byte === expectedChecksum[index]);
}

function decodeBase58(value: string): Uint8Array | undefined {
  let decoded = 0n;

  for (const char of value) {
    const digit = BASE58_ALPHABET.indexOf(char);
    if (digit === -1) {
      return undefined;
    }
    decoded = decoded * 58n + BigInt(digit);
  }

  const bytes: number[] = [];
  while (decoded > 0n) {
    bytes.unshift(Number(decoded % 256n));
    decoded /= 256n;
  }

  for (const char of value) {
    if (char !== "1") {
      break;
    }
    bytes.unshift(0);
  }

  return Uint8Array.from(bytes);
}

function sha256(value: Uint8Array): Uint8Array {
  return createHash("sha256").update(value).digest();
}
