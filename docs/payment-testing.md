# Payment Testing Guide

## 1. Verify Webhook is Receiving Events

```bash
railway logs 2>&1 | grep -E "webhook|paddle|subscription" | head -20
```

Check that `PADDLE_WEBHOOK_SECRET` in Railway matches the secret shown in:
**Paddle Dashboard → Developer Tools → Notifications → your endpoint → Secret key**

Verify the webhook URL is registered as:
```
https://rag-project-production-80af.up.railway.app/webhooks/paddle
```

---

## 2. Test Payment Without Real Money (Sandbox)

### Step 1 — Enable Sandbox mode in Paddle
Go to [sandbox-vendors.paddle.com](https://sandbox-vendors.paddle.com) and log in.

### Step 2 — Create sandbox products
Create products matching production structure:
- **Pro** — $19/month
- **Business** — $49/month

Note the sandbox Price IDs (format: `pri_sandbox_...`).

### Step 3 — Set Railway sandbox environment variables (temporary)
```
PADDLE_API_KEY=<sandbox API key>
PADDLE_PRICE_PRO=<sandbox pri_...>
PADDLE_CLIENT_TOKEN=<sandbox client token>
```

### Step 4 — Set frontend sandbox token
In `frontend/.env`:
```
VITE_PADDLE_CLIENT_TOKEN=<sandbox client token>
```
Then rebuild and redeploy frontend.

### Step 5 — Run a test purchase
Use Paddle's test card:
- **Number:** 4242 4242 4242 4242
- **Expiry:** any future date
- **CVV:** any 3 digits

### Step 6 — Verify webhook delivery
```bash
railway logs 2>&1 | grep -E "POST /webhooks|paddle|subscription" | tail -20
```

### Step 7 — Verify database update
Connect to the Railway PostgreSQL instance and run:
```sql
SELECT plan, plan_expires_at FROM users WHERE email='your@email.com';
```
Expected: `plan = 'pro'`, `plan_expires_at` set to ~30 days from now.

### Step 8 — Verify UI reflects new plan
Log in and go to **My Page → Subscription** — should show Pro plan.

### Step 9 — Restore live keys
After confirming sandbox works, revert Railway environment variables to live Paddle keys:
```
PADDLE_API_KEY=<live key>
PADDLE_PRICE_PRO=<live pri_...>
PADDLE_CLIENT_TOKEN=<live client token>
```
And restore `VITE_PADDLE_CLIENT_TOKEN` in frontend `.env`.

---

## 3. Webhook Event Reference

| Event | Handler | Expected action |
|-------|---------|-----------------|
| `transaction.completed` | `_handle_transaction_completed` | Upgrade user plan, process referral reward |
| `subscription.cancelled` | `_handle_subscription_cancelled` | Downgrade plan to free |
| `subscription.updated` | `_handle_subscription_updated` | Update plan expiry |
