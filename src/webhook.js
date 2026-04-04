'use strict';

const crypto = require('crypto');

/**
 * Verify an FintraPay webhook signature.
 *
 * FintraPay sends a HMAC-SHA256 hex digest of the raw request body in the
 * `X-FintraPay-Signature` header.  Use this helper to confirm the payload has
 * not been tampered with.
 *
 * @param {string|Buffer} rawBody  - The raw request body (do NOT parse it first).
 * @param {string}        signature - The value of the X-FintraPay-Signature header.
 * @param {string}        webhookSecret - Your webhook signing secret from the dashboard.
 * @returns {boolean} `true` when the signature is valid.
 *
 * @example
 * // ── Express (with express.raw() middleware) ──────────────────────────
 * const express = require('express');
 * const { verifyWebhookSignature } = require('fintrapay');
 *
 * const app = express();
 *
 * // IMPORTANT: use express.raw() so req.body is a Buffer, not parsed JSON.
 * app.post('/webhooks/fintrapay',
 *   express.raw({ type: 'application/json' }),
 *   (req, res) => {
 *     const sig = req.headers['x-fintrapay-signature'];
 *     if (!verifyWebhookSignature(req.body, sig, process.env.WEBHOOK_SECRET)) {
 *       return res.status(401).json({ error: 'Invalid signature' });
 *     }
 *     const event = JSON.parse(req.body);
 *     console.log('Verified event:', event.type);
 *     res.json({ received: true });
 *   }
 * );
 *
 * @example
 * // ── Raw Node.js http server ──────────────────────────────────────────
 * const http = require('http');
 * const { verifyWebhookSignature } = require('fintrapay');
 *
 * http.createServer((req, res) => {
 *   if (req.method === 'POST' && req.url === '/webhooks/fintrapay') {
 *     const chunks = [];
 *     req.on('data', (chunk) => chunks.push(chunk));
 *     req.on('end', () => {
 *       const rawBody = Buffer.concat(chunks);
 *       const sig = req.headers['x-fintrapay-signature'];
 *       if (!verifyWebhookSignature(rawBody, sig, process.env.WEBHOOK_SECRET)) {
 *         res.writeHead(401);
 *         return res.end('Invalid signature');
 *       }
 *       const event = JSON.parse(rawBody);
 *       console.log('Verified event:', event.type);
 *       res.writeHead(200, { 'Content-Type': 'application/json' });
 *       res.end(JSON.stringify({ received: true }));
 *     });
 *   }
 * }).listen(3000);
 */
function verifyWebhookSignature(rawBody, signature, webhookSecret) {
  if (!rawBody || !signature || !webhookSecret) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(typeof rawBody === 'string' ? rawBody : rawBody)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks.
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');

  if (sigBuf.length !== expBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuf, expBuf);
}

module.exports = { verifyWebhookSignature };
