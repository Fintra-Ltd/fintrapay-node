'use strict';

/**
 * FintraPay SDK Constants
 * Mirrors the Python SDK models.py enumerations and defaults.
 */

/** Default base URL for the FintraPay API */
const DEFAULT_BASE_URL = 'https://fintrapay.io/v1';

/** Default request timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 30000;

/** Supported blockchains */
const Blockchain = Object.freeze({
  ETHEREUM: 'ethereum',
  BSC: 'bsc',
  POLYGON: 'polygon',
  TRON: 'tron',
  SOLANA: 'solana',
  ARBITRUM: 'arbitrum',
  AVALANCHE: 'avalanche',
});

/** Supported currencies / tokens */
const Currency = Object.freeze({
  USDT: 'USDT',
  USDC: 'USDC',
  DAI: 'DAI',
  BUSD: 'BUSD',
});

/** Invoice / payment modes */
const Mode = Object.freeze({
  LIVE: 'live',
  TEST: 'test',
});

/** Invoice statuses */
const InvoiceStatus = Object.freeze({
  PENDING: 'pending',
  CONFIRMING: 'confirming',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
});

/** Payout statuses */
const PayoutStatus = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

/** Withdrawal statuses */
const WithdrawalStatus = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

/** Earn contract statuses */
const EarnStatus = Object.freeze({
  ACTIVE: 'active',
  MATURED: 'matured',
  BROKEN: 'broken',
  WITHDRAWN: 'withdrawn',
});

/** Refund statuses */
const RefundStatus = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  Blockchain,
  Currency,
  Mode,
  InvoiceStatus,
  PayoutStatus,
  WithdrawalStatus,
  EarnStatus,
  RefundStatus,
};
