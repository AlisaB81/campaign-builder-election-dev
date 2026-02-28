# Campaign Builder – Pricing & Governance (Internal)

**Status:** Draft (Authoritative Internal Reference)
**Audience:** Admin / Operator (Alisa)
**Purpose:** Define pricing logic, token governance, and managed campaign scope for all account types.

---

## 1. Core Pricing Philosophy

Campaign Builder is a **managed platform**, not a usage-based SaaS.

* Clients do **not** purchase tokens directly
* Tokens represent **monthly operational capacity**
* Pricing reflects:

  * Platform access
  * Infrastructure cost (email, SMS, AI, maps, hosting, DB)
  * Risk & compliance (political use, election periods)
  * Human labour (management levels)

> Tokens are an allowance, not an entitlement.

---

## 2. Account Types

### 2.1 Regular Account

* No election tools
* No client sub-accounts
* Access to:

  * Dashboard analytics
  * Email, SMS, AI calling
  * Template builder
  * Request tab

### 2.2 EDA Account

* Primary non-election political account
* Access to:

  * All Regular features
  * Higher token allocations
  * Managed campaign options

### 2.3 Election Campaign Mode

* Time-limited, high-risk account state
* Unlocks:

  * Lists & voter segmentation
  * Canvassing
  * Route planning / navigation
  * Scrutineering
  * Volunteer & role-based access

---

## 3. Security & Compliance (All Accounts)

All paid accounts include:

* Mandatory NDA acceptance
* Mandatory 2FA / OTP enforcement
* Role-based access control
* Auditable request workflow

---

## 4. Token System

### 4.1 Token Types

Each account has **three independent monthly pools**:

* Email tokens (Postmark)
* SMS tokens (Twilio)
* AI calling tokens (Twilio + OpenAI)

### 4.2 Minimum Baseline (All Paid Accounts)

* 5,000 email tokens / month
* 5,000 SMS tokens / month
* 5,000 AI calling tokens / month

### 4.3 Monthly Reset & Anti-Hoarding

* Tokens are replenished monthly
* Tokens do **not** accumulate indefinitely
* Each pool has a **rolling balance cap**:

```
rolling_cap = monthly_allocation × 1.5
```

At reset:

* New tokens added
* Balance capped at rolling limit

This prevents hoarding while allowing light rollover.

### 4.4 Large Contact Lists (e.g. 50,000+)

* Contact count does **not** auto-increase tokens
* Large lists require:

  * Higher tier, or
  * Admin-approved token uplift

---

## 5. Managed Campaign Levels

### Level 0 – Self-Serve

**Included in:** Bronze

Admin provides:

* Platform availability
* Integrations & infrastructure
* Security & token governance

Admin does **not**:

* Build campaigns
* Edit content
* Schedule sends

---

### Level 1 – Partial Management (Assisted)

**Included in:** Silver

Admin provides:

* Campaign review & sanity checks
* Template customization
* Scheduling assistance
* Campaign logic fixes

Admin does **not**:

* Own strategy
* Monitor replies
* Run ongoing cadence

---

### Level 2 – Full Management

**Included in:** Gold
**Optional / Required in:** Platinum

Admin provides:

* Campaign design & execution
* List building & segmentation
* Message drafting/finalization
* Scheduling & pacing
* Multi-channel coordination

Hard limits:

* Monthly campaign volume capped
* No real-time, on-demand execution
* No outcome guarantees

---

## 6. Election Campaign Mode – Management Matrix

| Election Mode | Management Level | Notes           |
| ------------- | ---------------- | --------------- |
| Platform Only | Level 0          | Client-operated |
| Assisted      | Level 1          | Admin assists   |
| Fully Managed | Level 2          | Admin-operated  |

Election-specific exclusions (always):

* No legal compliance responsibility
* No voter data sourcing
* No political outcome guarantees

---

## 7. Pricing Tiers (Internal Targets – CAD / month)

### Bronze – Platform Access

* **$500 / month**
* EDA or Regular account
* Level 0 management
* Baseline tokens only

### Silver – Active Outreach

* **$1,000 / month**
* Level 1 management
* Increased token allocations
* Automation & advanced analytics

### Gold – Managed Campaigns

* **$2,000 – $2,500 / month**
* Level 2 management
* High token allocations
* Campaign caps defined in agreement

### Platinum – Election Campaign Mode

* **$3,500 – $6,000+ / month**
* Election Mode enabled
* Management level selectable
* Token allocations customized
* Risk & urgency premium applies

---

## 8. Requests & Exceptions

* All extra requests go through Request tab
* Token increases are:

  * Reviewed
  * Approved
  * Logged
* Out-of-scope work:

  * Deferred, or
  * Quoted separately

---

## 9. Internal Rule of Thumb

> If it increases urgency, risk, or labour, it must increase price — not tokens.

This document governs pricing decisions and overrides ad-hoc exceptions.
