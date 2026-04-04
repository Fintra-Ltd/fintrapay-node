'use strict';

/**
 * FintraPay Node.js SDK
 *
 * Zero-dependency client for the FintraPay crypto payment gateway API.
 *
 * @example
 * const { FintraPay, verifyWebhookSignature } = require('fintrapay');
 *
 * const client = new FintraPay({
 *   apiKey: process.env.FINTRAPAY_API_KEY,
 *   apiSecret: process.env.FINTRAPAY_API_SECRET,
 * });
 *
 * // Create an invoice
 * const invoice = await client.createInvoice({
 *   amount: '100.00',
 *   currency: 'USDT',
 *   blockchain: 'polygon',
 * });
 */

const { FintraPay } = require('./client');
const { verifyWebhookSignature } = require('./webhook');
const constants = require('./constants');

module.exports = {
  // Main client
  FintraPay,

  // Webhook helpers
  verifyWebhookSignature,

  // Constants / enums
  ...constants,
};
