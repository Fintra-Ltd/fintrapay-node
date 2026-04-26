'use strict';

const crypto = require('crypto');

/**
 * Verify an FintraPay v2 webhook signature.
 *
 * The v2 envelope signs `timestamp + "\n" + rawBody` with HMAC-SHA256, hex-encoded.
 * Pass the timestamp from the `X-FintraPay-Timestamp` header. The helper also
 * rejects deliveries older than `maxAgeSeconds` so a leaked signature can't be
 * replayed indefinitely.
 *
 * @param {string|Buffer} rawBody  Raw request body (do NOT parse JSON first).
 * @param {string} signature       Value of the `X-FintraPay-Signature` header.
 * @param {string} webhookSecret   Your webhook secret.
 * @param {Object} [opts]
 * @param {string} [opts.timestamp]      Value of `X-FintraPay-Timestamp` (RFC3339). Required for v2.
 * @param {number} [opts.maxAgeSeconds]  Reject deliveries older than this. Default 300.
 * @returns {boolean} `true` if signature valid AND timestamp is within window.
 *
 * @example
 * // ── Express (with express.raw() middleware) ──────────────────────────
 * app.post('/webhooks/fintrapay',
 *   express.raw({ type: 'application/json' }),
 *   (req, res) => {
 *     const sig = req.headers['x-fintrapay-signature'];
 *     const ts  = req.headers['x-fintrapay-timestamp'];
 *     if (!verifyWebhookSignature(req.body, sig, process.env.WEBHOOK_SECRET, { timestamp: ts })) {
 *       return res.status(401).json({ error: 'Invalid signature' });
 *     }
 *     const event = JSON.parse(req.body);
 *     res.json({ received: true });
 *   });
 *
 * @example
 * // ── Raw Node.js http server ──────────────────────────────────────────
 * http.createServer((req, res) => {
 *   const chunks = [];
 *   req.on('data', c => chunks.push(c));
 *   req.on('end', () => {
 *     const rawBody = Buffer.concat(chunks);
 *     const sig = req.headers['x-fintrapay-signature'];
 *     const ts  = req.headers['x-fintrapay-timestamp'];
 *     if (!verifyWebhookSignature(rawBody, sig, process.env.WEBHOOK_SECRET, { timestamp: ts })) {
 *       res.writeHead(401); return res.end('Invalid signature');
 *     }
 *     // ...
 *   });
 * }).listen(3000);
 */
function verifyWebhookSignature(rawBody, signature, webhookSecret, opts = {}) {
  if (!rawBody || !signature || !webhookSecret) return false;

  const { timestamp, maxAgeSeconds = 300 } = opts;
  const bodyBuf = typeof rawBody === 'string' ? Buffer.from(rawBody) : rawBody;

  let payload;
  if (timestamp) {
    // Freshness check (defeats replay).
    const tsMs = Date.parse(timestamp);
    if (Number.isNaN(tsMs)) return false;
    if (Math.abs(Date.now() - tsMs) > maxAgeSeconds * 1000) return false;
    // v2 signing: HMAC over (timestamp + "\n" + body).
    payload = Buffer.concat([Buffer.from(`${timestamp}\n`), bodyBuf]);
  } else {
    // Legacy v1 fallback — body-only. v2 deliveries will fail this path.
    payload = bodyBuf;
  }

  const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');

  // Constant-time comparison.
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

module.exports = { verifyWebhookSignature };
