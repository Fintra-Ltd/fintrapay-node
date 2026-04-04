'use strict';

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { DEFAULT_BASE_URL, DEFAULT_TIMEOUT_MS } = require('./constants');

/**
 * FintraPay API client.
 *
 * Every request is authenticated with HMAC-SHA256 signing:
 *   signature = HMAC-SHA256(apiSecret, timestamp + method + path + body)
 *
 * Headers sent on every request:
 *   X-API-Key      — your API key
 *   X-Timestamp    — Unix epoch seconds (string)
 *   X-Signature    — hex-encoded HMAC digest
 */
class FintraPay {
  /**
   * @param {Object}  opts
   * @param {string}  opts.apiKey    - API key from the FintraPay dashboard.
   * @param {string}  opts.apiSecret - API secret for HMAC signing.
   * @param {string}  [opts.baseUrl=https://fintrapay.io/v1] - API base URL.
   * @param {number}  [opts.timeout=30000] - Request timeout in milliseconds.
   */
  constructor({ apiKey, apiSecret, baseUrl, timeout } = {}) {
    if (!apiKey) throw new Error('apiKey is required');
    if (!apiSecret) throw new Error('apiSecret is required');

    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeout = timeout || DEFAULT_TIMEOUT_MS;
  }

  // ──────────────────────────── Internal helpers ────────────────────────────

  /**
   * Produce the HMAC-SHA256 hex signature for a request.
   * @private
   */
  _sign(method, path, body) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = timestamp + method.toUpperCase() + path + (body || '');
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(payload)
      .digest('hex');
    return { timestamp, signature };
  }

  /**
   * Execute an HTTP(S) request using only built-in Node.js modules.
   * @private
   * @returns {Promise<Object>} Parsed JSON response body.
   */
  _request(method, path, data) {
    const bodyStr = data ? JSON.stringify(data) : '';
    const { timestamp, signature } = this._sign(method, path, bodyStr);
    const fullUrl = this.baseUrl + path;
    const parsed = new URL(fullUrl);

    const headers = {
      'X-API-Key': this.apiKey,
      'X-Timestamp': timestamp,
      'X-Signature': signature,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (bodyStr) {
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const transport = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: method.toUpperCase(),
      headers,
      timeout: this.timeout,
    };

    return new Promise((resolve, reject) => {
      const req = transport.request(options, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let body;
          try {
            body = JSON.parse(raw);
          } catch (_) {
            body = raw;
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            const err = new Error(
              body && body.detail
                ? body.detail
                : body && body.message
                ? body.message
                : `HTTP ${res.statusCode}`
            );
            err.statusCode = res.statusCode;
            err.body = body;
            reject(err);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      if (bodyStr) {
        req.write(bodyStr);
      }
      req.end();
    });
  }

  /**
   * Build a query-string path from a base path and an object of optional params.
   * @private
   */
  _buildPath(base, params) {
    if (!params) return base;
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(
        ([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)
      )
      .join('&');
    return qs ? base + '?' + qs : base;
  }

  // ──────────────────────────── Invoices ────────────────────────────────────

  /**
   * Create a payment invoice.
   * @param {Object} opts
   * @param {string|number} opts.amount
   * @param {string} opts.currency
   * @param {string} opts.blockchain
   * @param {string} [opts.mode]
   * @param {string[]} [opts.acceptedTokens]
   * @param {string[]} [opts.acceptedChains]
   * @param {string} [opts.externalId]
   * @param {number} [opts.expiryMinutes]
   * @returns {Promise<Object>}
   */
  createInvoice({
    amount,
    currency,
    blockchain,
    mode,
    acceptedTokens,
    acceptedChains,
    externalId,
    expiryMinutes,
    successUrl,
    cancelUrl,
  } = {}) {
    const body = { amount };
    if (currency) body.currency = currency;
    if (blockchain) body.blockchain = blockchain;
    if (mode !== undefined) body.mode = mode;
    if (acceptedTokens !== undefined) body.accepted_tokens = acceptedTokens;
    if (acceptedChains !== undefined) body.accepted_chains = acceptedChains;
    if (externalId !== undefined) body.external_id = externalId;
    if (expiryMinutes !== undefined) body.expiry_minutes = expiryMinutes;
    if (successUrl) body.success_url = successUrl;
    if (cancelUrl) body.cancel_url = cancelUrl;
    return this._request('POST', '/invoices', body);
  }

  /**
   * Retrieve a single invoice by ID.
   * @param {string} invoiceId
   * @returns {Promise<Object>}
   */
  getInvoice(invoiceId) {
    return this._request('GET', `/invoices/${invoiceId}`);
  }

  /**
   * List invoices with optional filters.
   * @param {Object} [params]
   * @param {string} [params.status]
   * @param {string} [params.blockchain]
   * @param {string} [params.currency]
   * @param {string} [params.mode]
   * @param {number} [params.page]
   * @param {number} [params.pageSize]
   * @returns {Promise<Object>}
   */
  listInvoices({ status, blockchain, currency, mode, page, pageSize } = {}) {
    const path = this._buildPath('/invoices', {
      status,
      blockchain,
      currency,
      mode,
      page,
      page_size: pageSize,
    });
    return this._request('GET', path);
  }

  // ──────────────────────────── Payouts ─────────────────────────────────────

  /**
   * Create a single payout.
   * @param {Object} opts
   * @param {string} opts.toAddress
   * @param {string|number} opts.amount
   * @param {string} opts.currency
   * @param {string} opts.blockchain
   * @param {string} [opts.reason]
   * @param {string} [opts.reference]
   * @returns {Promise<Object>}
   */
  createPayout({ toAddress, amount, currency, blockchain, reason, reference } = {}) {
    const body = { to_address: toAddress, amount, currency, blockchain };
    if (reason !== undefined) body.reason = reason;
    if (reference !== undefined) body.reference = reference;
    return this._request('POST', '/payouts', body);
  }

  /**
   * Create a batch payout to multiple recipients.
   * @param {Object} opts
   * @param {string} opts.currency
   * @param {string} opts.blockchain
   * @param {Array<{address: string, amount: string|number}>} opts.recipients
   * @returns {Promise<Object>}
   */
  createBatchPayout({ currency, blockchain, recipients } = {}) {
    return this._request('POST', '/payouts/batch', {
      currency,
      blockchain,
      recipients,
    });
  }

  /**
   * Retrieve a single payout by ID.
   * @param {string} payoutId
   * @returns {Promise<Object>}
   */
  getPayout(payoutId) {
    return this._request('GET', `/payouts/${payoutId}`);
  }

  /**
   * List payouts with optional filters.
   * @param {Object} [params]
   * @param {string} [params.status]
   * @param {number} [params.page]
   * @param {number} [params.pageSize]
   * @returns {Promise<Object>}
   */
  listPayouts({ status, page, pageSize } = {}) {
    const path = this._buildPath('/payouts', {
      status,
      page,
      page_size: pageSize,
    });
    return this._request('GET', path);
  }

  // ──────────────────────────── Withdrawals ─────────────────────────────────

  /**
   * Create a withdrawal.
   * @param {Object} opts
   * @param {string|number} opts.amount
   * @param {string} opts.currency
   * @param {string} opts.blockchain
   * @returns {Promise<Object>}
   */
  createWithdrawal({ amount, currency, blockchain } = {}) {
    return this._request('POST', '/withdrawals', { amount, currency, blockchain });
  }

  /**
   * Retrieve a single withdrawal by ID.
   * @param {string} withdrawalId
   * @returns {Promise<Object>}
   */
  getWithdrawal(withdrawalId) {
    return this._request('GET', `/withdrawals/${withdrawalId}`);
  }

  /**
   * List withdrawals with optional filters.
   * @param {Object} [params]
   * @param {number} [params.page]
   * @param {number} [params.pageSize]
   * @returns {Promise<Object>}
   */
  listWithdrawals({ page, pageSize } = {}) {
    const path = this._buildPath('/withdrawals', {
      page,
      page_size: pageSize,
    });
    return this._request('GET', path);
  }

  // ──────────────────────────── Earn ────────────────────────────────────────

  /**
   * Create an earn (staking / yield) contract.
   * @param {Object} opts
   * @param {string|number} opts.amount
   * @param {string} opts.currency
   * @param {string} opts.blockchain
   * @param {number} opts.durationMonths
   * @returns {Promise<Object>}
   */
  createEarnContract({ amount, currency, blockchain, durationMonths } = {}) {
    return this._request('POST', '/earn/contracts', {
      amount,
      currency,
      blockchain,
      duration_months: durationMonths,
    });
  }

  /**
   * Retrieve a single earn contract by ID.
   * @param {string} contractId
   * @returns {Promise<Object>}
   */
  getEarnContract(contractId) {
    return this._request('GET', `/earn/contracts/${contractId}`);
  }

  /**
   * List earn contracts with optional filters.
   * @param {Object} [params]
   * @param {string} [params.status]
   * @param {number} [params.page]
   * @returns {Promise<Object>}
   */
  listEarnContracts({ status, page } = {}) {
    const path = this._buildPath('/earn/contracts', { status, page });
    return this._request('GET', path);
  }

  /**
   * Withdraw accrued interest from an earn contract.
   * @param {string} contractId
   * @param {string|number} amount
   * @returns {Promise<Object>}
   */
  withdrawEarnInterest(contractId, amount) {
    return this._request('POST', `/earn/contracts/${contractId}/withdraw-interest`, {
      amount,
    });
  }

  /**
   * Break (early-terminate) an earn contract.
   * @param {string} contractId
   * @returns {Promise<Object>}
   */
  breakEarnContract(contractId) {
    return this._request('POST', `/earn/contracts/${contractId}/break`);
  }

  // ──────────────────────────── Refunds ─────────────────────────────────────

  /**
   * Create a refund for an invoice.
   * @param {string} invoiceId
   * @param {Object} [opts]
   * @param {string|number} [opts.amount]
   * @param {string} [opts.toAddress]
   * @param {string} [opts.reason]
   * @param {string} [opts.customerEmail]
   * @returns {Promise<Object>}
   */
  createRefund(invoiceId, { amount, toAddress, reason, customerEmail } = {}) {
    const body = {};
    if (amount !== undefined) body.amount = amount;
    if (toAddress !== undefined) body.to_address = toAddress;
    if (reason !== undefined) body.reason = reason;
    if (customerEmail !== undefined) body.customer_email = customerEmail;
    return this._request('POST', `/invoices/${invoiceId}/refunds`, body);
  }

  /**
   * Retrieve a single refund by ID.
   * @param {string} refundId
   * @returns {Promise<Object>}
   */
  getRefund(refundId) {
    return this._request('GET', `/refunds/${refundId}`);
  }

  /**
   * List refunds with optional filters.
   * @param {Object} [params]
   * @param {string} [params.status]
   * @param {number} [params.page]
   * @param {number} [params.pageSize]
   * @returns {Promise<Object>}
   */
  listRefunds({ status, page, pageSize } = {}) {
    const path = this._buildPath('/refunds', {
      status,
      page,
      page_size: pageSize,
    });
    return this._request('GET', path);
  }

  /**
   * List all refunds for a specific invoice.
   * @param {string} invoiceId
   * @returns {Promise<Object>}
   */
  listInvoiceRefunds(invoiceId) {
    return this._request('GET', `/invoices/${invoiceId}/refunds`);
  }

  // ──────────────────────────── Balance ──────────────────────────────────────

  /**
   * Get merchant wallet balances.
   * @returns {Promise<Object>}
   */
  getBalance() {
    return this._request('GET', '/balance');
  }

  // ──────────────────────────── Batch Payouts ───────────────────────────────

  /**
   * List batch payouts with pagination.
   * @param {Object} [params]
   * @param {number} [params.page]
   * @param {number} [params.pageSize]
   * @returns {Promise<Object>}
   */
  listBatchPayouts({ page = 1, pageSize = 20 } = {}) {
    const path = this._buildPath('/payouts/batches', {
      page,
      page_size: pageSize,
    });
    return this._request('GET', path);
  }

  /**
   * Retrieve a single batch payout by ID.
   * @param {string} batchId
   * @returns {Promise<Object>}
   */
  getBatchPayout(batchId) {
    return this._request('GET', `/payouts/batches/${batchId}`);
  }

  // ──────────────────────────── Fees ────────────────────────────────────────

  /**
   * Estimate fees for a transaction.
   * @param {Object} opts
   * @param {string|number} opts.amount
   * @param {string} opts.currency
   * @param {string} opts.blockchain
   * @returns {Promise<Object>}
   */
  estimateFees({ amount, currency, blockchain } = {}) {
    return this._request('POST', '/fees/estimate', {
      amount,
      currency,
      blockchain,
    });
  }

  // ──────────────────────────── Tickets ─────────────────────────────────────

  /**
   * Create a support ticket.
   * @param {Object} opts
   * @param {string} opts.subject
   * @param {string} opts.message
   * @param {string} [opts.priority='medium']
   * @returns {Promise<Object>}
   */
  createTicket({ subject, message, priority = 'medium' } = {}) {
    return this._request('POST', '/tickets', {
      subject,
      message,
      priority,
    });
  }

  /**
   * List support tickets with pagination.
   * @param {Object} [params]
   * @param {number} [params.page]
   * @param {number} [params.pageSize]
   * @returns {Promise<Object>}
   */
  listTickets({ page = 1, pageSize = 20 } = {}) {
    const path = this._buildPath('/tickets', {
      page,
      page_size: pageSize,
    });
    return this._request('GET', path);
  }

  /**
   * Retrieve a single support ticket by ID.
   * @param {string} ticketId
   * @returns {Promise<Object>}
   */
  getTicket(ticketId) {
    return this._request('GET', `/tickets/${ticketId}`);
  }

  /**
   * Reply to a support ticket.
   * @param {string} ticketId
   * @param {string} message
   * @returns {Promise<Object>}
   */
  replyTicket(ticketId, message) {
    return this._request('POST', `/tickets/${ticketId}/reply`, { message });
  }

  // ──────────────────────────── Earn (Interest History) ─────────────────────

  /**
   * Get interest accrual history for an earn contract.
   * @param {string} contractId
   * @returns {Promise<Object>}
   */
  getInterestHistory(contractId) {
    return this._request('GET', `/earn/contracts/${contractId}/interest-history`);
  }

  // ──────────────────────────── Payment Links ──────────────────────────────

  /**
   * Create a payment link.
   * @param {string} title
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  createPaymentLink(title, options = {}) {
    return this._request('POST', '/payment-links', { title, ...options });
  }

  /**
   * List payment links with optional filters.
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  listPaymentLinks(options = {}) {
    const path = this._buildPath('/payment-links', options);
    return this._request('GET', path);
  }

  /**
   * Retrieve a single payment link by ID.
   * @param {string} linkId
   * @returns {Promise<Object>}
   */
  getPaymentLink(linkId) {
    return this._request('GET', `/payment-links/${linkId}`);
  }

  /**
   * Update a payment link.
   * @param {string} linkId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  updatePaymentLink(linkId, data) {
    return this._request('PATCH', `/payment-links/${linkId}`, data);
  }

  // ──────────────────────────── Subscription Plans ─────────────────────────

  /**
   * Create a subscription plan.
   * @param {string} name
   * @param {string|number} amount
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  createSubscriptionPlan(name, amount, options = {}) {
    return this._request('POST', '/subscription-plans', { name, amount, ...options });
  }

  /**
   * List subscription plans with optional filters.
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  listSubscriptionPlans(options = {}) {
    const path = this._buildPath('/subscription-plans', options);
    return this._request('GET', path);
  }

  /**
   * Retrieve a single subscription plan by ID.
   * @param {string} planId
   * @returns {Promise<Object>}
   */
  getSubscriptionPlan(planId) {
    return this._request('GET', `/subscription-plans/${planId}`);
  }

  /**
   * Update a subscription plan.
   * @param {string} planId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  updateSubscriptionPlan(planId, data) {
    return this._request('PATCH', `/subscription-plans/${planId}`, data);
  }

  // ──────────────────────────── Subscriptions ──────────────────────────────

  /**
   * Create a subscription.
   * @param {string} planId
   * @param {string} customerEmail
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  createSubscription(planId, customerEmail, options = {}) {
    return this._request('POST', '/subscriptions', {
      plan_id: planId,
      customer_email: customerEmail,
      ...options,
    });
  }

  /**
   * List subscriptions with optional filters.
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  listSubscriptions(options = {}) {
    const path = this._buildPath('/subscriptions', options);
    return this._request('GET', path);
  }

  /**
   * Retrieve a single subscription by ID.
   * @param {string} subscriptionId
   * @returns {Promise<Object>}
   */
  getSubscription(subscriptionId) {
    return this._request('GET', `/subscriptions/${subscriptionId}`);
  }

  /**
   * Cancel a subscription.
   * @param {string} subscriptionId
   * @param {string|null} [reason]
   * @returns {Promise<Object>}
   */
  cancelSubscription(subscriptionId, reason = null) {
    const body = {};
    if (reason !== null) body.reason = reason;
    return this._request('POST', `/subscriptions/${subscriptionId}/cancel`, body);
  }

  /**
   * Pause a subscription.
   * @param {string} subscriptionId
   * @returns {Promise<Object>}
   */
  pauseSubscription(subscriptionId) {
    return this._request('POST', `/subscriptions/${subscriptionId}/pause`);
  }

  /**
   * Resume a subscription.
   * @param {string} subscriptionId
   * @returns {Promise<Object>}
   */
  resumeSubscription(subscriptionId) {
    return this._request('POST', `/subscriptions/${subscriptionId}/resume`);
  }

  // ──────────────────────────── Deposit API ────────────────────────────────

  /**
   * Create a deposit user.
   * @param {string} externalUserId
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  createDepositUser(externalUserId, options = {}) {
    return this._request('POST', '/deposit-api/users', {
      external_user_id: externalUserId,
      ...options,
    });
  }

  /**
   * Retrieve a deposit user by external ID.
   * @param {string} externalUserId
   * @returns {Promise<Object>}
   */
  getDepositUser(externalUserId) {
    return this._request('GET', `/deposit-api/users/${externalUserId}`);
  }

  /**
   * List deposit users with optional filters.
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  listDepositUsers(options = {}) {
    const path = this._buildPath('/deposit-api/users', options);
    return this._request('GET', path);
  }

  /**
   * Update a deposit user.
   * @param {string} externalUserId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  updateDepositUser(externalUserId, data) {
    return this._request('PATCH', `/deposit-api/users/${externalUserId}`, data);
  }

  /**
   * Create a deposit address for a user on a specific blockchain.
   * @param {string} externalUserId
   * @param {string} blockchain
   * @returns {Promise<Object>}
   */
  createDepositAddress(externalUserId, blockchain) {
    return this._request('POST', `/deposit-api/users/${externalUserId}/addresses`, {
      blockchain,
    });
  }

  /**
   * Create deposit addresses on all supported blockchains for a user.
   * @param {string} externalUserId
   * @returns {Promise<Object>}
   */
  createAllDepositAddresses(externalUserId) {
    return this._request('POST', `/deposit-api/users/${externalUserId}/addresses/all`);
  }

  /**
   * List deposit addresses for a user.
   * @param {string} externalUserId
   * @returns {Promise<Object>}
   */
  listDepositAddresses(externalUserId) {
    return this._request('GET', `/deposit-api/users/${externalUserId}/addresses`);
  }

  /**
   * List deposits with optional filters.
   * If options.externalUserId is provided, lists deposits for that user.
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  listDeposits(options = {}) {
    const { externalUserId, ...params } = options;
    const base = externalUserId
      ? `/deposit-api/users/${externalUserId}/deposits`
      : '/deposit-api/deposits';
    const path = this._buildPath(base, params);
    return this._request('GET', path);
  }

  /**
   * Retrieve a single deposit by ID.
   * @param {string} depositId
   * @returns {Promise<Object>}
   */
  getDeposit(depositId) {
    return this._request('GET', `/deposit-api/deposits/${depositId}`);
  }

  /**
   * List deposit balances for a user.
   * @param {string} externalUserId
   * @returns {Promise<Object>}
   */
  listDepositBalances(externalUserId) {
    return this._request('GET', `/deposit-api/users/${externalUserId}/balances`);
  }
}

module.exports = { FintraPay };
