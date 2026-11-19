/**
 * ============================================================================
 * MODULE: crypto.ts
 * HYPERLEDGER FABRIC EQUIVALENT:
 *   - Fabric CA (Certificate Authority) & Membership Service Provider (MSP)
 *   - Local MSP keystore (ECDSA P-256 private keys) & signcerts (X.509 public certs)
 *   - BCCSP (Blockchain Cryptographic Service Provider) SW/PKCS11 SHA-256 & ECDSA
 *
 * NODE.JS / BACKEND EQUIVALENT:
 *   - `fabric-ca-client` enrollment & `crypto.subtle` / Node `crypto` module
 * ============================================================================
 */

export interface OrgKeyPairJWK {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
  publicKeyFingerprint: string;
}

/**
 * Converts an ArrayBuffer to a lowercase hexadecimal string.
 */
export function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  const hexParts: string[] = [];
  for (let i = 0; i < byteArray.length; i++) {
    hexParts.push(byteArray[i].toString(16).padStart(2, '0'));
  }
  return hexParts.join('');
}

/**
 * Converts a hexadecimal string back into an ArrayBuffer.
 */
export function hexToBuffer(hex: string): ArrayBuffer {
  const cleanHex = hex.trim().replace(/[^0-9a-fA-F]/g, '');
  if (cleanHex.length % 2 !== 0) {
    throw new Error('Invalid hex string length');
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

/**
 * Computes a deterministic SHA-256 cryptographic hash using the Web Crypto API.
 * Maps to Hyperledger Fabric BCCSP SHA-256 block header & data hashing.
 */
export async function sha256Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hashBuffer);
}

/**
 * Deterministically serializes an object with sorted keys so that
 * cryptographic signatures and block hashes are reproducible across peers.
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((item) => canonicalizeJson(item)).join(',') + ']';
  }
  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const parts = sortedKeys
    .filter((k) => record[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalizeJson(record[k])}`);
  return '{' + parts.join(',') + '}';
}

/**
 * Generates an ECDSA P-256 key pair using the browser's Web Crypto API
 * and exports it as JWK for persistence in the simulated MSP keystore.
 */
export async function generateOrgECDSAKeyPair(): Promise<OrgKeyPairJWK> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign', 'verify']
  );

  const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

  const rawPub = `${publicKeyJwk.x || ''}.${publicKeyJwk.y || ''}`;
  const fullHash = await sha256Hex(rawPub);
  const publicKeyFingerprint = `ECDSA-P256:${fullHash.slice(0, 16).toUpperCase()}`;

  return {
    publicKeyJwk,
    privateKeyJwk,
    publicKeyFingerprint,
  };
}

/**
 * Digitally signs a canonical payload string using an organization's ECDSA P-256 private key.
 * Equivalent to a Fabric peer/client endorsing a transaction proposal with its MSP identity.
 */
export async function signPayloadECDSA(
  payloadString: string,
  privateKeyJwk: JsonWebKey
): Promise<string> {
  const privateKey = await window.crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false,
    ['sign']
  );

  const encoder = new TextEncoder();
  const data = encoder.encode(payloadString);

  const signatureBuffer = await window.crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    privateKey,
    data
  );

  return bufferToHex(signatureBuffer);
}

/**
 * Verifies an ECDSA P-256 signature against a canonical payload string and the signer's public key.
 * Equivalent to Fabric committing peers validating endorsement signatures against the Channel MSP.
 */
export async function verifySignatureECDSA(
  payloadString: string,
  signatureHex: string,
  publicKeyJwk: JsonWebKey
): Promise<boolean> {
  try {
    const publicKey = await window.crypto.subtle.importKey(
      'jwk',
      publicKeyJwk,
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      false,
      ['verify']
    );

    const encoder = new TextEncoder();
    const data = encoder.encode(payloadString);
    const sigBuffer = hexToBuffer(signatureHex);

    return await window.crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      publicKey,
      sigBuffer,
      data
    );
  } catch {
    return false;
  }
}
