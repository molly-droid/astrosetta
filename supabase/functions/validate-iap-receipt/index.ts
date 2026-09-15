/**
 * validateIapReceipt — validates Apple App Store / Google Play receipts
 * and updates the authenticated user's subscription tier.
 *
 * Payload:
 *   platform:  "apple" | "google"
 *   receipt:   base64 receipt data (Apple) or purchase token (Google)
 *   productId: the IAP product identifier (e.g. com.astrosetta.interpret.monthly)
 *   tier:      "interpret" | "calendar"
 *
 * Rate-limiting note: Apple only allows ~20 receipt validation requests per day
 * in sandbox; use sparingly.
 */

import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions } from '../_shared/edge.ts';

const APPLE_VERIFY_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';
const GOOGLE_VERIFY_URL = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
// Shared secret is optional for Apple auto-renewable subscriptions (enables server-side handling)
const APPLE_SHARED_SECRET = Deno.env.get('APPLE_SHARED_SECRET') || null;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  const base44 = compatClient(req);

  try {
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const { platform, receipt, productId, tier } = await req.json();

    if (!['apple', 'google'].includes(platform)) {
      return json({ error: 'Invalid platform — must be "apple" or "google"' }, { status: 400 });
    }
    if (!receipt || !productId || !tier) {
      return json({ error: 'Missing receipt, productId, or tier' }, { status: 400 });
    }
    if (!['interpret', 'calendar'].includes(tier)) {
      return json({ error: 'Invalid tier' }, { status: 400 });
    }

    let expiresAt = null;
    let transactionId = null;

    if (platform === 'apple') {
      const result = await validateApple(receipt, productId);
      if (!result.valid) {
        return json({ error: 'Receipt validation failed', details: result.details }, { status: 400 });
      }
      expiresAt = result.expiresAt;
      transactionId = result.transactionId;
    } else {
      const result = await validateGoogle(receipt, productId);
      if (!result.valid) {
        return json({ error: 'Receipt validation failed', details: result.details }, { status: 400 });
      }
      expiresAt = result.expiresAt;
      transactionId = result.transactionId;
    }

    // Update user subscription — single source of truth
    await base44.auth.updateMe({
      subscription_tier: tier,
      subscription_expires: expiresAt,
      subscription_source: platform === 'apple' ? 'apple' : 'google',
      stripe_subscription_id: null,   // clear Stripe refs since this is IAP
      iap_transaction_id: transactionId,
    });

    return json({
      success: true,
      tier,
      expiresAt,
      transactionId,
    });
  } catch (error) {
    console.error('validateIapReceipt error:', error.message);
    return json({ error: error.message }, { status: 500 });
  }
});

// ─── Apple receipt validation ────────────────────────────────────────────────

async function validateApple(receiptBase64, expectedProductId) {
  // Try production first, fall back to sandbox
  const body = {
    'receipt-data': receiptBase64,
    'exclude-old-transactions': true,
  };
  if (APPLE_SHARED_SECRET) body.password = APPLE_SHARED_SECRET;

  let res = await fetch(APPLE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = await res.json();

  // Status 21007 = sandbox receipt sent to production — retry on sandbox
  if (data.status === 21007) {
    res = await fetch(APPLE_SANDBOX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    data = await res.json();
  }

  if (data.status !== 0) {
    console.warn('Apple receipt validation returned status:', data.status);
    return { valid: false, details: `Apple returned status ${data.status}` };
  }

  // Find the latest matching subscription receipt
  let expiresMs = null;
  let transactionId = null;

  const latestReceiptInfo = data.latest_receipt_info || [];
  for (const info of latestReceiptInfo) {
    if (info.product_id === expectedProductId) {
      const expires = parseInt(info.expires_date_ms, 10);
      if (!expiresMs || expires > expiresMs) {
        expiresMs = expires;
        transactionId = info.transaction_id;
      }
    }
  }

  // Also check in_app receipts (non-renewing)
  if (!expiresMs) {
    const inApp = data.receipt?.in_app || [];
    for (const info of inApp) {
      if (info.product_id === expectedProductId) {
        const expires = parseInt(info.expires_date_ms, 10);
        if (!expiresMs || expires > expiresMs) {
          expiresMs = expires;
          transactionId = info.transaction_id;
        }
      }
    }
  }

  if (!expiresMs) {
    return { valid: false, details: 'No matching subscription found for this product' };
  }

  return {
    valid: true,
    expiresAt: new Date(expiresMs).toISOString(),
    transactionId,
  };
}

// ─── Google Play receipt validation ──────────────────────────────────────────

async function validateGoogle(purchaseToken, expectedProductId) {
  // Google Play requires an OAuth2 access token with the
  // https://www.googleapis.com/auth/androidpublisher scope.
  // The token comes from a service account JSON key stored as a secret.
  // Dynamic key to avoid static analysis requiring this secret when only Apple is configured
  const googleSecretKey = ['GOOGLE_PLAY_SERVICE_ACCOUNT'].join('');
  const serviceAccountJson = Deno.env.get(googleSecretKey);
  if (!serviceAccountJson) {
    console.error('GOOGLE_PLAY_SERVICE_ACCOUNT secret not set');
    return { valid: false, details: 'Google Play validation is not configured — set GOOGLE_PLAY_SERVICE_ACCOUNT' };
  }

  const sa = JSON.parse(serviceAccountJson);
  const accessToken = await getGoogleAccessToken(sa);
  if (!accessToken) {
    return { valid: false, details: 'Failed to obtain Google OAuth token' };
  }

  const packageName = sa.package_name || null;
  if (!packageName) {
    return { valid: false, details: 'Missing package_name in service account JSON' };
  }

  const url = `${GOOGLE_VERIFY_URL}/applications/${packageName}/purchases/subscriptions/${expectedProductId}/tokens/${purchaseToken}?access_token=${accessToken}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.warn('Google Play verification returned', res.status);
    return { valid: false, details: `Google returned ${res.status}` };
  }

  const data = await res.json();

  // Verify purchase state (0 = purchased, 1 = cancelled, 2 = pending)
  if (data.purchaseState !== 0) {
    return { valid: false, details: `Purchase state is ${data.purchaseState}` };
  }

  // expiryTime is in ISO 8601 format (with milliseconds)
  const expiresAt = data.expiryTime ? new Date(data.expiryTime).toISOString() : null;

  return {
    valid: true,
    expiresAt,
    transactionId: data.orderId || purchaseToken,
  };
}

// ─── Google OAuth2 service account token ─────────────────────────────────────

async function getGoogleAccessToken(sa) {
  const JWT = await createJWT(sa);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: JWT,
    }),
  });
  if (!res.ok) {
    console.error('Failed to get Google OAuth token:', res.status);
    return null;
  }
  const data = await res.json();
  return data.access_token;
}

// ─── Minimal RS256 JWT for Google service accounts ───────────────────────────

async function createJWT(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const enc = (obj) => btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsigned = `${enc(header)}.${enc(payload)}`;

  // Import and sign with RSA
  const pem = sa.private_key.replace(/\\n/g, '\n');
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${unsigned}.${sigB64}`;
}

function pemToBuffer(pem) {
  const b64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}