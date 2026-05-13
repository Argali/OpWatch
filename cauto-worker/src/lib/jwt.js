/**
 * App JWT — sign and verify using jose (Web Crypto, Workers-native).
 * Azure AD token validation uses the Microsoft JWKS endpoint.
 */

import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";

// ── App JWT ───────────────────────────────────────────────────────────────────

function secret(env) {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function signToken(payload, env) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .setJti(crypto.randomUUID())
    .sign(secret(env));
}

export async function verifyToken(token, env) {
  const { payload } = await jwtVerify(token, secret(env));
  return payload;
}

// ── Azure AD token ────────────────────────────────────────────────────────────
// Cache the JWKS keyset across requests (Workers isolate lifetime)
let _azureJwks = null;

export async function verifyAzureToken(token, env) {
  if (!_azureJwks) {
    _azureJwks = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/discovery/v2.0/keys`)
    );
  }
  const { payload } = await jwtVerify(token, _azureJwks, {
    audience: env.AZURE_CLIENT_ID,
    issuer:   `https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/v2.0`,
  });
  return payload;
}
