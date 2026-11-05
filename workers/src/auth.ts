export interface DecodedIdToken {
  uid: string;
  email?: string;
  [key: string]: unknown;
}

interface JwkKey {
  kid: string;
  alg: string;
  kty: string;
  n: string;
  e: string;
  use?: string;
}

interface JwkSet {
  keys: JwkKey[];
}

let cachedJwks: { keys: JwkKey[]; expiresAt: number } | null = null;

function base64UrlDecode(str: string): string {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) {
    b64 += '=';
  }
  return atob(b64);
}

function base64UrlToUint8Array(str: string): Uint8Array {
  const binary = base64UrlDecode(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Fetches and caches Google's public JWK set for Firebase Auth token verification. */
async function getGoogleJwks(): Promise<JwkKey[]> {
  const now = Date.now();
  if (cachedJwks && cachedJwks.expiresAt > now) {
    return cachedJwks.keys;
  }

  const url = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch Google public JWKS: HTTP ${res.status}`);
  }

  const cacheHeader = res.headers.get('cache-control') || '';
  const match = cacheHeader.match(/max-age=(\d+)/);
  const maxAgeSeconds = match ? parseInt(match[1], 10) : 3600;

  const data = (await res.json()) as JwkSet;
  cachedJwks = {
    keys: data.keys,
    expiresAt: now + maxAgeSeconds * 1000,
  };
  return cachedJwks.keys;
}

/**
 * Cryptographically verifies a Firebase ID Token using Google's public JWKS and WebCrypto.
 * Returns the decoded token payload including verified `uid`.
 */
export async function verifyFirebaseIdToken(token: string, expectedProjectId: string): Promise<DecodedIdToken> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT: must contain three dot-separated segments.');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string; kid?: string };
  let payload: { aud?: string; iss?: string; sub?: string; exp?: number; iat?: number; [key: string]: unknown };

  try {
    header = JSON.parse(base64UrlDecode(headerB64));
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    throw new Error('Invalid JWT: segment is not valid base64url JSON.');
  }

  if (header.alg !== 'RS256') {
    throw new Error(`Invalid token algorithm: expected RS256, got ${header.alg}`);
  }
  if (!header.kid) {
    throw new Error('Token header missing key identifier (kid).');
  }

  // 1. Verify Claims
  const nowSec = Math.floor(Date.now() / 1000);
  const clockSkew = 300; // 5 minutes allowance

  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Token payload missing valid subject (sub / uid).');
  }
  if (payload.aud !== expectedProjectId) {
    throw new Error(`Token audience (${payload.aud}) does not match Firebase Project ID (${expectedProjectId}).`);
  }
  const expectedIssuer = `https://securetoken.google.com/${expectedProjectId}`;
  if (payload.iss !== expectedIssuer) {
    throw new Error(`Token issuer (${payload.iss}) does not match expected (${expectedIssuer}).`);
  }
  if (typeof payload.exp !== 'number' || payload.exp < nowSec - clockSkew) {
    throw new Error('Token has expired.');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + clockSkew) {
    throw new Error('Token issued in the future.');
  }

  // 2. Cryptographic Signature Verification
  const jwks = await getGoogleJwks();
  const matchingJwk = jwks.find((k) => k.kid === header.kid);
  if (!matchingJwk) {
    throw new Error(`No matching public key found for kid: ${header.kid}`);
  }

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: matchingJwk.kty,
      n: matchingJwk.n,
      e: matchingJwk.e,
      alg: 'RS256',
      ext: true,
    },
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['verify'],
  );

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signatureBytes = base64UrlToUint8Array(signatureB64);

  const isSignatureValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    signatureBytes as Uint8Array<ArrayBuffer>,
    signedData,
  );

  if (!isSignatureValid) {
    throw new Error('Cryptographic signature verification failed.');
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    ...payload,
  };
}
