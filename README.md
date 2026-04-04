# fintrapay-node

Official Node.js SDK for the [FintraPay](https://fintrapay.io) crypto payment gateway API. Accept stablecoin payments, payment links, subscriptions, deposit API, payouts, withdrawals, and earn yield -- all with automatic HMAC-SHA256 request signing.

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://www.npmjs.com/package/fintrapay)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-14%2B-blue.svg)](https://nodejs.org/)

---

## Installation

```bash
npm install fintrapay
```

## Quick Start

### Create an Invoice

```js
const { FintraPay } = require('fintrapay');

const client = new FintraPay({
  apiKey: 'xfp_key_your_api_key',
  apiSecret: 'xfp_secret_your_api_secret',
});

// Single-token invoice
const invoice = await client.createInvoice({
  amount: '100.00',
  currency: 'USDT',
  blockchain: 'tron',
});
console.log(`Payment address: ${invoice.payment_address}`);
console.log(`Invoice ID: ${invoice.id}`);

// Multi-token invoice (customer chooses at checkout)
const multiInvoice = await client.createInvoice({
  amount: '250.00',
  acceptedTokens: ['USDT', 'USDC'],
  acceptedChains: ['tron', 'bsc', 'ethereum'],
});
```

### Verify a Webhook

```js
const { verifyWebhookSignature } = require('fintrapay');

// Express (use express.raw() middleware)
app.post('/webhooks/fintrapay',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const sig = req.headers['x-fintrapay-signature'];
    if (!verifyWebhookSignature(req.body, sig, process.env.WEBHOOK_SECRET)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    const event = JSON.parse(req.body);
    if (event.type === 'invoice.paid') {
      console.log(`Invoice ${event.data.id} paid!`);
    }
    res.json({ received: true });
  }
);
```

## API Reference

All methods return Promises and are available on the `FintraPay` client instance. HMAC-SHA256 signing is handled automatically.

### Invoices

| Method | Description |
|--------|-------------|
| `createInvoice({ amount, currency, blockchain, ... })` | Create a payment invoice |
| `getInvoice(invoiceId)` | Get invoice by ID |
| `listInvoices({ status, blockchain, currency, ... })` | List invoices with filters |

### Payouts

| Method | Description |
|--------|-------------|
| `createPayout({ toAddress, amount, currency, blockchain, ... })` | Create a single payout |
| `createBatchPayout({ currency, blockchain, recipients })` | Create a batch payout |
| `getPayout(payoutId)` | Get payout by ID |
| `listPayouts({ status, page, pageSize })` | List payouts with filters |
| `listBatchPayouts({ page, pageSize })` | List batch payouts |
| `getBatchPayout(batchId)` | Get batch payout details |

### Withdrawals

| Method | Description |
|--------|-------------|
| `createWithdrawal({ amount, currency, blockchain })` | Withdraw to your registered wallet |
| `getWithdrawal(withdrawalId)` | Get withdrawal by ID |
| `listWithdrawals({ page, pageSize })` | List withdrawals |

### Earn

| Method | Description |
|--------|-------------|
| `createEarnContract({ amount, currency, blockchain, durationMonths })` | Create an Earn contract |
| `getEarnContract(contractId)` | Get Earn contract by ID |
| `listEarnContracts({ status, page })` | List Earn contracts |
| `withdrawEarnInterest(contractId, amount)` | Withdraw accrued interest (min $10) |
| `breakEarnContract(contractId)` | Early-break an Earn contract |
| `getInterestHistory(contractId)` | Get daily interest accrual history |

### Refunds

| Method | Description |
|--------|-------------|
| `createRefund(invoiceId, { amount, toAddress, reason, ... })` | Create a refund for a paid invoice |
| `getRefund(refundId)` | Get refund by ID |
| `listRefunds({ status, page, pageSize })` | List all refunds |
| `listInvoiceRefunds(invoiceId)` | List refunds for a specific invoice |

### Payment Links

| Method | Description |
|--------|-------------|
| `createPaymentLink(title, options)` | Create a reusable payment link |
| `listPaymentLinks(options)` | List payment links with filters |
| `getPaymentLink(linkId)` | Get payment link by ID |
| `updatePaymentLink(linkId, data)` | Update a payment link |

### Subscription Plans

| Method | Description |
|--------|-------------|
| `createSubscriptionPlan(name, amount, options)` | Create a subscription plan |
| `listSubscriptionPlans(options)` | List subscription plans |
| `getSubscriptionPlan(planId)` | Get plan by ID |
| `updateSubscriptionPlan(planId, data)` | Update a subscription plan |

### Subscriptions

| Method | Description |
|--------|-------------|
| `createSubscription(planId, customerEmail, options)` | Create a subscription |
| `listSubscriptions(options)` | List subscriptions with filters |
| `getSubscription(subscriptionId)` | Get subscription with invoice history |
| `cancelSubscription(subscriptionId, reason)` | Cancel a subscription |
| `pauseSubscription(subscriptionId)` | Pause an active subscription |
| `resumeSubscription(subscriptionId)` | Resume a paused subscription |

### Deposit API

| Method | Description |
|--------|-------------|
| `createDepositUser(externalUserId, options)` | Register end user for deposits |
| `getDepositUser(externalUserId)` | Get user with addresses and balances |
| `listDepositUsers(options)` | List deposit users |
| `updateDepositUser(externalUserId, data)` | Update user (email, label, is_active, is_blocked) |
| `createDepositAddress(externalUserId, blockchain)` | Generate address for a chain |
| `createAllDepositAddresses(externalUserId)` | Generate addresses for all 7 chains |
| `listDepositAddresses(externalUserId)` | List all addresses for a user |
| `listDeposits(options)` | List deposit events (optionally by user) |
| `getDeposit(depositId)` | Get single deposit detail |
| `listDepositBalances(externalUserId)` | Get per-token per-chain balances |

### Balance & Fees

| Method | Description |
|--------|-------------|
| `getBalance()` | Get custodial balances across all chains |
| `estimateFees({ amount, currency, blockchain })` | Estimate transaction fees |

### Support Tickets

| Method | Description |
|--------|-------------|
| `createTicket({ subject, message, priority })` | Create a support ticket |
| `listTickets({ page, pageSize })` | List support tickets |
| `getTicket(ticketId)` | Get ticket by ID |
| `replyTicket(ticketId, message)` | Reply to a support ticket |

## Error Handling

The SDK rejects promises with descriptive errors for different scenarios:

```js
const { FintraPay } = require('fintrapay');

const client = new FintraPay({
  apiKey: 'xfp_key_...',
  apiSecret: 'xfp_secret_...',
});

try {
  const invoice = await client.createInvoice({
    amount: '100.00',
    currency: 'USDT',
    blockchain: 'tron',
  });
} catch (err) {
  if (err.statusCode === 401) {
    // Invalid API key or secret
    console.error('Auth failed:', err.message);
  } else if (err.statusCode === 422) {
    // Invalid request parameters
    console.error('Validation error:', err.message, err.body);
  } else if (err.statusCode === 429) {
    // Too many requests
    console.error('Rate limited:', err.message);
  } else {
    // Network or other error
    console.error('Error:', err.message);
  }
}
```

## Webhook Verification

Always verify webhook signatures before processing events. Use the raw request body -- do NOT parse JSON first.

### Express

```js
const express = require('express');
const { verifyWebhookSignature } = require('fintrapay');

const app = express();

// IMPORTANT: use express.raw() so req.body is a Buffer, not parsed JSON
app.post('/webhooks/fintrapay',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const sig = req.headers['x-fintrapay-signature'];
    if (!verifyWebhookSignature(req.body, sig, process.env.WEBHOOK_SECRET)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    const event = JSON.parse(req.body);
    console.log('Verified event:', event.type);
    res.json({ received: true });
  }
);
```

### Raw Node.js HTTP Server

```js
const http = require('http');
const { verifyWebhookSignature } = require('fintrapay');

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhooks/fintrapay') {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks);
      const sig = req.headers['x-fintrapay-signature'];
      if (!verifyWebhookSignature(rawBody, sig, process.env.WEBHOOK_SECRET)) {
        res.writeHead(401);
        return res.end('Invalid signature');
      }
      const event = JSON.parse(rawBody);
      console.log('Verified event:', event.type);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: true }));
    });
  }
}).listen(3000);
```

## Requirements

- Node.js 14 or later
- Zero external dependencies (uses built-in `crypto`, `http`, `https` modules)

## Supported Chains & Tokens

7 blockchains: TRON, BSC, Ethereum, Solana, Base, Arbitrum, Polygon

6 stablecoins: USDT, USDC, DAI, FDUSD, TUSD, PYUSD

## Links

- [FintraPay Homepage](https://fintrapay.io)
- [API Documentation](https://fintrapay.io/docs)
- [GitHub Repository](https://github.com/Fintra-Ltd/fintrapay-node)

## License

MIT License. See [LICENSE](LICENSE) for details.
