# Targoman AI Platform — Commercial Architecture

**Document:** `docs/architecture/10-commercial-architecture.md`  
**Version:** 0.1  
**Status:** Proposed Architecture  
**Depends on:**

- `00-manifest.md`
- `01-system-architecture.md`
- `02-engineering-conventions.md`
- `03-persistence-and-database.md`
- `04-authorization-model.md`
- `05-module-architecture.md`
- `07-ai-router.md`
- `08-deployment-architecture.md`
- `09-notification-and-ticketing.md`

---

# 1. Purpose

This document defines the architecture of the optional Commercial capability of the **Targoman AI Platform**.

It specifies:

- Product;
- Offering / Sellable;
- Catalog;
- Saved Cart;
- Basket Token;
- Checkout;
- Reservation;
- Transaction Voucher;
- Financial Transaction;
- Payment;
- Wallet;
- Ledger;
- Credit;
- Discount;
- Tax;
- Currency;
- Invoice;
- Refund;
- Reversal;
- Entitlement;
- Fulfillment;
- Usage;
- Subscription;
- Bundle / Composite Offering;
- reseller;
- operator;
- settlement;
- payout;
- external storefronts;
- idempotency;
- reconciliation;
- audit;
- concurrency;
- recovery;
- authorization;
- testing.

The central rules are:

> **A business/service module owns what is being sold and what the purchaser receives.**

> **Commercial Core owns reusable transaction mechanics.**

> **Financial Core is the sole canonical owner of monetary calculation and monetary state.**

> **Payment success and service fulfillment are different facts.**

> **Ledger entries, not mutable balance fields, are the source of financial truth.**

---

# 2. Commercial Is Optional

The Platform must operate in enterprise/internal deployments with:

```text
Commercial = Disabled
```

Business modules must not require purchasing merely because they support commercial offerings.

---

# 3. Commercial Enablement Does Not Change Module Semantics

A module such as Widget may be:

```text
internally allocated by administrator
```

or:

```text
commercially purchased
```

without maintaining two different Widget domain models.

Commerce changes acquisition.

It does not redefine the acquired service.

---

# 4. Commercial Architecture Has Three Primary Ownership Layers

```text
Service / Business Module
    ↓
Product / Offering
Reservation
Entitlement
Fulfillment
Usage Meaning
Inventory / Capacity Meaning

Commercial Application
    ↓
Catalog
Saved Cart
Basket Token
Checkout Coordination
Purchase Projection

Financial Core
    ↓
Money
Voucher Financial Finalization
Financial Transaction
Payment
Wallet
Ledger
Refund / Reversal
Settlement / Payout
Invoice Financial Facts
```

These boundaries are semantic.

They do not require network microservices.

---

# 5. Bundle Is a Service Domain

Cross-service bundles are not owned by Financial Core merely because they contain several products.

A Bundle capability may act as a Service Domain that owns:

- Composite Product;
- Composite Offering;
- component coordination;
- bundle reservation;
- bundle fulfillment;
- compensation.

---

# 6. Commercial Core Does Not Own Service Meaning

Commercial Core must not decide:

- what one Widget package provides;
- how long a Secretariat subscription lasts;
- how many AI tokens a service credit grants;
- which Documents a package unlocks;
- how an entitlement is activated;
- whether service inventory exists.

These facts belong to the Offering owner.

---

# 7. Service Module Does Not Own Monetary Truth

A module must not independently perform:

- Wallet mutation;
- Ledger posting;
- authoritative currency conversion;
- authoritative tax calculation;
- Payment settlement;
- Refund accounting;
- financial balance calculation.

Those belong to Financial Core.

---

# 8. Product Defines What Is Acquired

A Product represents the thing or service entitlement being acquired.

Examples:

```text
One-month Widget subscription

Three-month Widget subscription

100,000 AI-token entitlement

Secretariat connector activation

Additional 50 GB knowledge storage
```

---

# 9. Product Duration Is Product Meaning

A one-month subscription and a three-month subscription are normally different Products when the acquired rights differ.

Duration must not be hidden only inside pricing metadata if it changes fulfillment semantics.

---

# 10. Product Is Not Directly Purchasable

A Product describes what is acquired.

An Offering / Sellable describes how that Product can currently be acquired.

Only an active Offering enters commercial purchase preparation.

---

# 11. Offering / Sellable Defines Sale Terms

An Offering may define or reference:

- Product;
- seller/operator;
- currency;
- base price;
- sales window;
- quantity rules;
- commercial availability;
- reseller availability;
- reservation requirements;
- service-specific sale terms.

---

# 12. Offering Does Not Own Financial Execution

An Offering may provide the commercial price proposal.

Final financial calculation and execution remain Financial Core responsibility.

---

# 13. Product and Offering Have Stable IDs

Product identity and Offering identity are separate.

Changing price does not require changing Product identity.

A new materially different acquired service should not reuse an old Product identity merely for convenience.

---

# 14. Offering Versioning Is Explicit

A price or commercial-term change must not silently change an already prepared purchase.

The Offering version or signed commitment used in purchase preparation is preserved.

---

# 15. Price Has Validity

A quoted Offering price may have:

```text
validFrom
validUntil
```

or an equivalent validity policy.

A price outside its validity period cannot be used to create a new Voucher.

---

# 16. Catalog Is a Projection

The Catalog aggregates active Offerings for discovery.

It is not the canonical owner of Product or Offering truth.

Conceptually:

```text
Service Modules
    ↓
Published Offerings
    ↓
Commercial Catalog Projection
```

---

# 17. Catalog May Be Tenant-Specific

Different tenants may see different Offerings based on:

- tenant;
- operator;
- contract;
- reseller;
- deployment;
- product policy.

Catalog visibility still requires Authority where applicable.

---

# 18. Catalog Visibility Is Not Purchase Eligibility

A user may discover an Offering but still be unable to purchase it.

Purchase eligibility may additionally depend on:

- Authority;
- tenant policy;
- entitlement;
- service capacity;
- commercial restrictions.

---

# 19. Saved Cart Is Optional Convenience State

A Saved Cart may persist items the user is considering.

It is not financial truth.

---

# 20. Saved Cart Does Not Reserve Capacity

Adding an Offering to a Saved Cart does not normally:

- reserve inventory;
- freeze price;
- create financial obligation;
- create Entitlement.

---

# 21. Saved Cart May Become Stale

When reopening a Saved Cart:

- Offering may no longer exist;
- price may have changed;
- capacity may be unavailable;
- eligibility may have changed.

Checkout therefore revalidates all lines.

---

# 22. Basket Token Is a Purchase-Preparation Representation

The purchase flow may construct a virtual Basket Token representing a candidate purchase.

Conceptually:

```text
Selected Offerings
    ↓
Validated Basket Representation
    ↓
Voucher Preparation
```

The Basket Token is not Ledger or Payment truth.

---

# 23. Basket Token May Be Signed

Where useful for stateless checkout or cross-boundary coordination, Basket representation may be:

- canonicalized;
- signed;
- time-bounded.

A signed Basket proves integrity.

It does not create payment or entitlement.

---

# 24. Basket Does Not Own Reservation

Finite service capacity is reserved by the owning Service Domain during Voucher preparation.

A cart or Basket does not independently reserve service capacity.

---

# 25. Checkout Is a Process, Not Financial Truth

Checkout coordinates:

```text
validate customer
validate Offerings
validate purchase eligibility
prepare reservations
obtain price commitments
perform financial calculation
issue Transaction Voucher
```

Checkout state may exist operationally.

It is not the final financial specification.

---

# 26. Purchase Preparation Is Contract-Based

For each line, Commercial requests the owning module to prepare acquisition.

Conceptually:

```text
Commercial
    ↓
Prepare Purchase Line
    ↓
Owning Service
```

The service returns an immutable time-bounded commitment.

---

# 27. Service Commitment Defines Service Truth

A service-side commitment may contain:

- Product identity;
- Offering identity/version;
- quantity;
- service description snapshot;
- entitlement terms;
- reservation reference;
- price proposal;
- tax classification facts where applicable;
- validity/expiry;
- service correlation ID.

---

# 28. Service Commitment Does Not Post Money

The service provides commercial/service facts.

It does not create Wallet or Ledger entries.

---

# 29. Service Commitment Is Immutable During Validity

Once a commitment is accepted for Voucher preparation, its meaning must not change silently during its validity window.

---

# 30. Finite Capacity Requires Reservation

If fulfillment depends on scarce/finite capacity:

```text
Validate Availability
+
Create Reservation
+
Issue Commitment
```

should be atomic inside the owning Service Domain where practical.

---

# 31. Reservation Has Explicit Expiry

A finite reservation must have bounded validity.

Expired reservations release capacity automatically or through an idempotent controlled process.

---

# 32. Reservation Is Service-Owned

Examples:

```text
GPU capacity slot
limited subscription seat
scarce license
physical inventory
```

have service-specific reservation semantics.

Commercial Core must not invent one universal inventory model.

---

# 33. Reservation Expiry Does Not Cancel Existing Finalized Acquisition

A reservation protects pre-financial-finality capacity.

After service capture/acquisition succeeds, the relevant service state replaces the reservation.

---

# 34. Voucher Preparation Validates All Lines

A Transaction Voucher may be issued only after all required line commitments and financial calculations are valid.

---

# 35. Transaction Voucher Is the Immutable Transaction Specification

The Transaction Voucher records what is financially agreed.

Conceptually:

```text
Transaction Voucher
├── Buyer
├── Seller / Operator
├── Currency
├── Lines
│   ├── Product snapshot
│   ├── Offering snapshot
│   ├── Quantity
│   ├── Unit price
│   ├── Discount allocation
│   ├── Tax allocation
│   └── Service commitment
├── Totals
├── Payment terms
├── Expiry
└── Version / Signature
```

---

# 36. Voucher Is Immutable After Issue

An issued Voucher must not be edited.

If the commercial specification changes:

```text
old Voucher
    → cancelled/expired
new Voucher
    → issued
```

---

# 37. Voucher Captures Human-Readable Snapshots

Voucher lines preserve sufficient descriptive information to remain understandable even if Product/Offering display data changes later.

Examples:

```text
Product name
Offering description
quantity
commercial terms summary
```

---

# 38. Voucher Does Not Read Current Catalog for Historical Truth

Historical purchase interpretation must not depend on today's Offering state.

The Voucher snapshot is the transaction specification used for that purchase.

---

# 39. Voucher Has Absolute Expiry

A Voucher may have:

```text
issuedAt
expiresAt
```

After expiry it cannot begin a new Financial Transaction unless explicit policy permits renewal/reissue.

---

# 40. Zero-Value Purchase Still Uses Voucher

A payable total of zero does not bypass transaction preparation.

Example:

```text
discount = 100%
payable = 0
```

still requires deterministic acquisition and financial evidence.

---

# 41. Voucher Is Separate From Payment

Voucher answers:

> What is the approved transaction specification?

Payment answers:

> How was monetary obligation satisfied?

These are different facts.

---

# 42. Voucher Is Separate From Fulfillment

Voucher does not prove:

```text
service activated
```

It specifies what should be acquired after financial finality.

---

# 43. Financial Transaction Executes One Voucher

A Financial Transaction represents financial execution of a Voucher.

Conceptually:

```text
Transaction Voucher
       ↓
Financial Transaction
       ↓
Payment / Wallet / Ledger
```

---

# 44. Financial Transaction Has Stable Identity

Retrying the same purchase execution must not create several independent monetary obligations.

Idempotency ties retryable execution to one logical Financial Transaction.

---

# 45. Financial Transaction Lifecycle Is Explicit

Possible states may include:

```text
PENDING
REQUIRES_PAYMENT
PROCESSING
SUCCEEDED
FAILED
UNKNOWN
CANCELLED
```

Exact state definitions are controlled by Financial Core.

---

# 46. Financial Success Is Not Fulfillment Success

This is valid:

```text
Financial Transaction = SUCCEEDED
Fulfillment = PENDING
```

and:

```text
Financial Transaction = SUCCEEDED
Fulfillment = FAILED_RETRYABLE
```

Money and service state remain separate.

---

# 47. Fulfillment Failure Does Not Rewrite Financial History

If payment succeeds but service activation fails:

```text
do not pretend payment failed
```

Recovery may require:

- retry;
- compensation;
- refund;
- operator intervention.

---

# 48. Payment Provider Is an Adapter

Financial Core uses provider-neutral Payment contracts.

Examples may include:

```text
bank gateway
card processor
customer payment service
manual payment confirmation
```

Provider SDKs stay behind adapters.

---

# 49. Payment Attempt Is Separate From Financial Transaction

One Financial Transaction may have multiple Payment Attempts.

Example:

```text
Financial Transaction
├── Attempt 1 → timeout
├── Attempt 2 → declined
└── Attempt 3 → success
```

---

# 50. Payment Status Must Be Provider-Verified

Browser redirect alone does not prove financial success.

Provider callback/status verification must be performed according to the provider contract.

---

# 51. Provider Callback Is Untrusted Input

Payment callbacks require:

- authentication/signature verification;
- amount validation;
- currency validation;
- transaction correlation;
- replay protection;
- provider-state validation.

---

# 52. Provider Amount Cannot Override Voucher Amount

If provider reports an amount inconsistent with canonical Financial Transaction state:

```text
do not silently accept
```

The operation enters error/reconciliation handling.

---

# 53. Payment Idempotency Is Mandatory

Repeated callback or status confirmation must not double-post monetary effects.

---

# 54. Unknown Payment Outcome Is First-Class

Example:

```text
provider request submitted
    ↓
network timeout
    ↓
provider outcome unknown
```

must become:

```text
UNKNOWN / RECONCILIATION_REQUIRED
```

not guessed success or failure.

---

# 55. Unknown Payment Must Not Be Blindly Retried

A blind second charge can produce duplicate payment.

Financial Core uses Reconciliation.

---

# 56. Payment Reconciliation Is Durable

Reconciliation may use:

- provider transaction lookup;
- callback history;
- provider reference;
- settlement report;
- operator resolution.

The unresolved state survives process restart.

---

# 57. Financial Core Owns Money

Canonical Money is:

```text
integer atomic amount
+
explicit currency
```

Floating-point arithmetic is prohibited.

---

# 58. Currency Is Explicit Everywhere

No Money field exists without currency context.

Never assume:

```text
default currency
```

inside stored monetary truth unless the contract explicitly fixes it.

---

# 59. Money Arithmetic Uses One Canonical Kernel

Financial calculation has one canonical implementation for:

- addition;
- subtraction;
- allocation;
- rounding;
- discount;
- tax;
- conversion;
- payable calculation.

---

# 60. Financial Kernel Is Pure

The Financial Kernel receives all required values explicitly.

It must not:

- query database;
- call provider;
- read current exchange rate;
- read wall clock;
- mutate Ledger.

---

# 61. Exchange Rate Is an Explicit Input

If currency conversion is supported, authoritative calculation receives a specific:

```text
source currency
target currency
rate
rate source
rate timestamp
rate/version
rounding rule
```

The rate used is preserved with the transaction.

---

# 62. Historical Transactions Never Reprice

Future exchange-rate changes do not modify existing Voucher or Ledger facts.

---

# 63. Rounding Rules Are Explicit

Financial calculations must define:

- rounding mode;
- allocation rule;
- residual handling;
- currency precision.

---

# 64. Allocation Must Reconcile Exactly

For a total:

```text
100
```

allocated across several lines, line allocations must sum exactly back to:

```text
100
```

in atomic units.

Floating residuals are prohibited.

---

# 65. Discount Is Distinct From Price

Offering price and applied Discount are separate facts.

A Voucher should preserve both where relevant.

---

# 66. Discount Policy Has an Owner

Discount may originate from:

- Offering;
- Commercial promotion;
- tenant contract;
- reseller agreement;
- Voucher code.

The owner supplies eligibility/facts.

Financial Core performs authoritative monetary calculation.

---

# 67. Voucher Code Is Not a Raw Price Override

A Voucher/Promotion code resolves through controlled policy.

Clients must not submit:

```text
discountAmount = arbitrary
```

as authoritative truth.

---

# 68. Tax Calculation Is Financial Authority

Where tax applies, Financial Core owns calculation using approved tax inputs/policy.

Service modules may provide tax classification facts.

They do not independently post tax amounts.

---

# 69. Tax Snapshot Is Preserved

Historical Voucher/Invoice must not derive tax from current future configuration.

---

# 70. Ledger Is the Canonical Monetary Record

Monetary effects are represented by immutable Ledger Entries.

Conceptually:

```text
Financial Transaction
        ↓
Posting Plan
        ↓
Ledger Entries
```

---

# 71. Ledger Entries Are Immutable

Posted Ledger Entries are never edited to "fix" history.

Corrections use additive entries.

---

# 72. Ledger Must Balance According to Its Accounting Model

Every posting operation must satisfy canonical balancing rules.

An unbalanced posting is invalid.

---

# 73. Ledger Mutation Is Atomic

All entries belonging to one financial posting operation are committed atomically.

Partial financial posting is prohibited.

---

# 74. Ledger Entries Have Stable Business Correlation

Ledger entries should reference the relevant:

- Financial Transaction;
- Refund;
- Reversal;
- Transfer;
- Settlement;
- Payout

without losing original business lineage.

---

# 75. Wallet Is a Ledger Account / Projection

A Wallet represents monetary holdings or financial account state.

Balance derives from Ledger.

Preferred:

```text
Ledger Entries
    ↓
Balance Projection
```

Not:

```text
UPDATE wallet
SET balance = balance + 100
```

as independent truth.

---

# 76. Cached Balance Is Derived

A balance cache/projection may exist for performance.

It must be reconstructable or reconcilable against Ledger.

---

# 77. Wallet Balance Cannot Become Negative Unless Policy Explicitly Allows It

If overdraft/credit facility is supported, that policy must be explicit.

Accidental negative balance is an integrity failure.

---

# 78. Wallet Owner Is Explicit

Possible Wallet owners may include:

```text
Tenant
Identity
Reseller
Operator
System clearing account
```

Owner type and identity are explicit.

---

# 79. Wallet Is Not Service Credit

Example:

```text
1,000,000 IRR Wallet balance
```

is financial state.

Example:

```text
100,000 AI tokens remaining
```

is service Entitlement/Usage state.

These must not be conflated.

---

# 80. Service Credits Belong to Service/Entitlement Domain

If a customer purchases:

```text
1,000,000 AI tokens
```

the monetary purchase belongs to Commercial/Financial.

The resulting token entitlement belongs to the service domain.

---

# 81. Non-Monetary Credit Does Not Use Financial Ledger by Default

Service units such as:

- token quota;
- message quota;
- storage allowance;
- seats

are not Money merely because users call them "credit."

They use service/Usage/Entitlement accounting.

---

# 82. Financial Credit Uses Ledger

Actual monetary credit, prepaid monetary value, or refundable Wallet value is Ledger-backed.

---

# 83. Transfer Is a Financial Operation

Wallet-to-Wallet transfer is executed through Financial Core.

It must:

- be idempotent;
- validate funds;
- post atomically;
- retain source/destination;
- preserve audit.

---

# 84. Refund Is Not Ledger Deletion

Refund creates new financial state compensating for a previous transaction.

Original Ledger Entries remain.

---

# 85. Reversal and Refund Are Different

A Reversal corrects/undoes a financial posting according to accounting/provider semantics.

A Refund is a business operation returning value to a payer/customer.

They may use different lifecycle and provider behavior.

---

# 86. Refund References Original Financial Lineage

A Refund must identify the originating:

- Voucher;
- Financial Transaction;
- Payment;
- relevant amount/lines.

---

# 87. Partial Refund Is Supported Where Product Policy Allows

A Refund may apply to:

- selected lines;
- selected quantities;
- selected amounts.

The financial allocation remains exact.

---

# 88. Refund Eligibility Is Not Purely Financial

Service Domain may need to determine whether an acquisition is refundable.

Financial Core executes monetary effects after validated eligibility.

---

# 89. Fulfillment Compensation and Refund Are Different

A failed service Fulfillment may trigger:

```text
service compensation
```

or:

```text
financial refund
```

or both.

The owning workflow decides which corrective action is appropriate.

---

# 90. Invoice Is Separate From Voucher

Transaction Voucher is the canonical immutable transaction specification.

Invoice is a human/accounting/fiscal document derived from transaction facts when required.

---

# 91. Invoice Derives From Voucher Facts

Invoice line identity, description, amounts, taxes, and allocations must derive from the immutable transaction specification and financial outcome.

It must not query current Offering data for historical fields.

---

# 92. Invoice Is Not the Payment State Machine

Changing Invoice state does not independently mark Payment successful.

---

# 93. Fiscal Document Is Optional by Deployment/Jurisdiction

Some deployments may require formal fiscal integrations.

Others may need only internal receipt/invoice rendering.

Fiscal integration remains adapter/policy driven.

---

# 94. Fiscal Provider Is Separate From Financial Truth

External tax/fiscal authority acceptance is an integration fact.

Ledger truth remains Financial Core-owned.

---

# 95. Invoice Numbering Is Controlled

Where legal/business invoice numbering is required, it uses a concurrency-safe canonical mechanism.

Client-generated invoice numbers are prohibited.

---

# 96. Invoice Rendering Uses Snapshot Data

PDF/HTML Invoice rendering must reproduce historical transaction facts deterministically.

---

# 97. Purchase Projection May Exist

For user/admin UX, Commercial may expose a generic Purchase/Order projection.

Example:

```text
Purchase #123
    Payment = succeeded
    Fulfillment = partial
```

This is a coordination/read model.

---

# 98. There Is No Universal Central Order Lifecycle

A generic Order must not collapse:

```text
Voucher
Payment
Entitlement
Fulfillment
Shipment
```

into one authoritative state.

---

# 99. User Dashboard May Display Orders/Purchases

The Dashboard may present a friendly:

```text
Orders
Purchases
```

view derived from canonical transaction and fulfillment facts.

Presentation terminology does not create a new source of truth.

---

# 100. Financial Finality Triggers Service Acquisition

After financial success:

```text
Financial Transaction Succeeded
    ↓
Durable Fulfillment / Acquisition Dispatch
    ↓
Owning Module
```

---

# 101. Fulfillment Dispatch Is Durable

Payment success and required service dispatch must not be separated by an unsafe in-memory callback.

Use:

```text
Financial Commit
+
Durable Outbox / Job
```

before considering dispatch scheduled.

---

# 102. Service Acquisition Is Idempotent

Retrying Fulfillment must not create duplicate:

- subscriptions;
- Widgets;
- storage packages;
- token entitlements;
- seats.

---

# 103. Service Domain Owns Entitlement

Entitlement answers:

> What right does the purchaser currently possess?

Examples:

```text
Widget active until date X

100,000 tokens available

50 GB additional storage

Secretariat connector entitlement
```

---

# 104. Entitlement Is Not Payment

Entitlement may persist beyond a specific payment transaction.

Payment history and current service right are separate.

---

# 105. Entitlement Has Its Own Lifecycle

Possible service-specific states include:

```text
PENDING
ACTIVE
SUSPENDED
EXPIRED
REVOKED
```

Exact lifecycle belongs to the owning service.

---

# 106. Commercial Core Does Not Mutate Entitlement Tables Directly

Required:

```text
Commercial
    ↓
Fulfillment Contract
    ↓
Service Application
    ↓
Service Persistence
```

---

# 107. Entitlement Activation May Fail

If payment succeeds but service activation fails:

```text
Financial = SUCCEEDED
Fulfillment = FAILED
```

This is recoverable state, not transactional contradiction.

---

# 108. Fulfillment Retry Is Bounded and Observable

Fulfillment uses:

- stable identity;
- retries;
- backoff;
- terminal state;
- reconciliation;
- operator intervention.

---

# 109. Fulfillment UNKNOWN Is Supported

If the service may have accepted activation but response was lost:

```text
do not blindly create again
```

Use Reconciliation.

---

# 110. Fulfillment Evidence Is Service-Owned

The service records what was actually created/activated.

Commercial may maintain a fulfillment projection for purchase status.

---

# 111. Usage Is Service-Owned Semantically

The service defines what consumption means.

Examples:

```text
AI output tokens
Widget conversations
Document processing
storage byte-days
API calls
```

---

# 112. Usage Accounting Is Shared

The Platform Usage capability records canonical consumption dimensions.

The module defines meter semantics.

---

# 113. Usage Is Not Money

Usage:

```text
50,000 output tokens
```

is distinct from:

```text
120,000 IRR
```

financial charge.

---

# 114. Rating Converts Usage to Commercial Value

If pay-as-you-go pricing exists:

```text
Usage
    ↓
Rating Policy
    ↓
Charge Specification
    ↓
Financial Posting
```

---

# 115. Rating Is Versioned

A usage charge must retain the rating/pricing version used.

Future price changes must not alter past charges.

---

# 116. Meter Unit Is Stable

A released meter such as:

```text
ai.output_tokens
```

must retain defined meaning.

A materially different measurement requires a new version/identifier.

---

# 117. Usage Event Is Idempotent

Repeated service reporting must not double-consume or double-charge the same Usage event.

---

# 118. Prepaid and Postpaid Are Different Commercial Policies

The architecture may support:

```text
PREPAID
POSTPAID
SUBSCRIPTION
PAY_AS_YOU_GO
```

where configured.

These policies must not be hidden in arbitrary module code.

---

# 119. Admission Control Uses Entitlement and Usage

Before expensive work:

```text
Authority
+
Entitlement
+
Usage / Quota
+
Admission Control
```

may all be relevant.

Commercial itself does not bypass Admission Control.

---

# 120. Subscription Is an Entitlement Pattern

Subscription may involve:

```text
Product
Offering
Voucher
Financial Transaction
Entitlement
Renewal Policy
```

The active service right remains Service-owned.

---

# 121. Recurring Billing Is Explicit

A subscription does not automatically authorize future charges merely because the first payment succeeded.

Recurring billing requires an explicit mandate/payment contract and applicable legal/provider support.

---

# 122. Renewal Is a New Financial Obligation

Each renewal produces new financial transaction evidence.

Historical billing periods are preserved.

---

# 123. Automatic Renewal Has Clear Stop Rules

Cancellation or non-renewal must define:

- effective time;
- future billing behavior;
- entitlement end behavior;
- already-paid period behavior.

---

# 124. Cancellation Is Not Refund

Stopping future renewal does not automatically reverse previous financial transactions.

---

# 125. Free Trial Is Not Fake Payment

A free trial may create a service Entitlement through a specific acquisition policy without inventing a monetary Payment.

If it represents a zero-value commercial acquisition, it may still use a zero-value Voucher where audit/commercial history requires it.

---

# 126. Bundles Combine Service-Owned Components

A Bundle may include:

```text
Widget Product
+
Storage Product
+
AI Token Product
```

The Bundle Service owns the composition.

---

# 127. Bundle Financial Line Preserves Component Allocation

Bundle Voucher data should retain sufficient component identity and allocated amounts for:

- tax;
- refund;
- settlement;
- fiscal evidence;
- analytics.

---

# 128. Bundle Preparation Is Multi-Domain Coordination

Each component Service may need to prepare:

- availability;
- reservation;
- commitment.

---

# 129. Bundle Preparation Requires Commit Barrier

A Composite Voucher should not be issued if mandatory component preparation fails.

Conceptually:

```text
Prepare A
Prepare B
Prepare C
    ↓
All valid?
    ↓
Issue Voucher
```

---

# 130. Failed Bundle Preparation Releases Reservations

If one mandatory component fails:

```text
prepared reservations
    ↓
compensate / release
```

through idempotent service operations.

---

# 131. Bundle Fulfillment May Be Partial Temporarily

After financial success:

```text
A fulfilled
B pending
C failed retryable
```

may exist temporarily.

Commercial must not rewrite payment status because of this.

---

# 132. Bundle Recovery Is Explicit

Persistent partial bundle Fulfillment requires:

- retry;
- compensation;
- operator intervention;
- possible Refund

according to product policy.

---

# 133. Reseller Is a Commercial Actor Type

The Platform may support:

```text
Operator
Customer
Reseller
Downstream Customer
```

as distinct commercial relationships.

Authority identity model remains separate from commercial role semantics.

---

# 134. Reseller Is Not Automatically an Authority Role

A Reseller business record does not by itself grant API/application permissions.

Authority grants access through explicit machine/human identities and scopes.

---

# 135. Reseller Machine Credentials Are First-Class Machine Identities

A reseller integration must not masquerade as the reseller owner's human identity.

The actual machine actor and commercial reseller context remain distinct.

---

# 136. Reseller Catalog Is a Projection

A Reseller-visible Catalog is derived from Offerings eligible for that Reseller.

It is not a second Product/Offering source of truth.

---

# 137. Reseller May Have Commercial Terms

Reseller-specific terms may include:

- wholesale price;
- commission;
- markup bounds;
- discount;
- settlement schedule;
- downstream eligibility.

Ownership of each term must be explicit.

---

# 138. External Reseller Storefront Remains External Truth

If a reseller operates:

```text
WordPress
external shop
customer portal
```

its own storefront Order remains its own domain fact.

The Platform should store correlation, not pretend to own external storefront lifecycle.

---

# 139. External Storefront Correlation Is Explicit

Platform purchase may record:

```text
reseller
external customer ID
external order ID
external line ID
external idempotency key
```

as correlation facts.

---

# 140. Platform Fulfillment Does Not Complete External Order Automatically

Platform may report:

```text
fulfillment succeeded
```

to reseller.

The external storefront remains responsible for its own external Order state.

---

# 141. Reseller Purchase Is Idempotent

External integration retries must use stable correlation/idempotency.

Repeated plugin requests must not create duplicate purchases.

---

# 142. Reseller Settlement Is Separate From Customer Purchase

A customer purchase may create obligations between:

- customer;
- operator;
- reseller.

Settlement calculates and executes those obligations separately from the original purchase lifecycle.

---

# 143. Commission Is Financially Accounted

Reseller commission must not exist only as a mutable number on an Order.

It produces auditable settlement/ledger facts when financially realized.

---

# 144. Settlement Has Explicit Period and Inputs

A Settlement may aggregate eligible financial facts for:

```text
reseller
operator
period
currency
```

according to policy.

---

# 145. Settlement Does Not Mutate Source Transactions

Settling a transaction marks settlement relations/state.

It does not rewrite the originating Voucher/Payment.

---

# 146. Settlement Is Idempotent

Repeated execution for the same settlement specification must not double-pay.

---

# 147. Payout Is Distinct From Settlement

Settlement answers:

> What amount is owed?

Payout answers:

> How was it transferred?

---

# 148. Payout Has Provider Attempts

Like Payment, one Payout may involve several provider attempts.

---

# 149. Unknown Payout Outcome Requires Reconciliation

Blind payout retry is prohibited when transfer may already have occurred.

---

# 150. Operator Is Explicit

A deployment may have:

```text
Targoman as commercial operator
```

or:

```text
Customer organization as commercial operator
```

or another approved operator arrangement.

Operator identity is deployment/commercial configuration.

---

# 151. Tenant and Commercial Operator Are Different

Tenant represents an application/data boundary.

Operator represents the entity operating commercial transactions.

They may coincide.

They need not.

---

# 152. Seller Is Explicit Per Voucher

The Transaction Voucher must identify the relevant seller/operator/legal commercial party required by the transaction model.

Do not infer it from the hostname.

---

# 153. Buyer Is Explicit

Buyer may represent:

```text
Tenant
Identity
Organization
Reseller downstream customer
```

according to the Offering and deployment model.

---

# 154. Payer and Beneficiary May Differ

Example:

```text
Company pays
Employee receives entitlement
```

Therefore distinguish:

```text
Buyer
Payer
Beneficiary
```

where the product supports it.

---

# 155. Actor and Buyer Are Different

The authenticated actor executing checkout may be:

```text
procurement operator
```

while the buyer is:

```text
Tenant A
```

Commercial audit preserves both.

---

# 156. Authority Context Is Consumed, Not Redefined

Commercial receives:

```text
actor identity
tenant
scope
authorization decision
```

from Authority.

Commercial must not create its own privilege system.

---

# 157. Commercial Privileges Are Explicit

Possible operations include:

```text
commercial.catalog.read
commercial.purchase.create
commercial.purchase.read
commercial.payment.manage
commercial.refund.request
commercial.refund.approve
commercial.wallet.read
commercial.wallet.manage
commercial.invoice.read
commercial.settlement.read
commercial.settlement.manage
commercial.admin
```

Final catalog is registered with Authority.

---

# 158. Sensitive Financial Operations May Require Stronger Authentication

Authority policy may require:

- MFA;
- recent authentication;
- stronger Role;
- dual control

for operations such as:

```text
large refund
payout
wallet adjustment
settlement approval
```

---

# 159. Financial Adjustment Is Not Ordinary CRUD

Manual financial correction must use a dedicated operation with:

- reason;
- Authority;
- audit;
- additive Ledger entries.

Direct row editing is prohibited.

---

# 160. Dual Control May Be Required

High-assurance deployment policy may require:

```text
one operator requests
another operator approves
```

for sensitive financial actions.

---

# 161. Approval Is Not Hidden Inside Role Name

Authority provides the actor's permission.

Commercial workflow separately tracks:

- request;
- approval;
- execution.

---

# 162. Break-Glass Does Not Rewrite Financial History

Emergency access may authorize an operation where policy permits.

It does not allow direct mutation of immutable Ledger/Voucher history.

---

# 163. Commercial Money Never Uses Float

This applies to:

- price;
- discount;
- tax;
- Wallet;
- Ledger;
- Payment;
- Refund;
- Settlement;
- Payout.

---

# 164. Percentages and Rates Have Explicit Precision

Percentage/rate representation must define its fixed precision or rational representation.

Arbitrary binary floating-point is not authoritative.

---

# 165. Financial Time Is Explicit

Financial timestamps use timezone-aware absolute time.

Examples:

```text
Voucher expiry
Payment confirmation
Settlement period boundary
Refund creation
```

---

# 166. Business Presentation May Be Jalali

Invoice/UI presentation may use Jalali dates where appropriate.

Canonical financial time remains standard absolute timestamp.

---

# 167. Financial State Changes Are Database-Audited

All auditable Commercial mutations participate in automatic database mutation audit.

---

# 168. Financial Semantic Audit Is Separate

Financial semantic audit records facts such as:

```text
why Refund was created
who approved adjustment
which Voucher caused posting
why reconciliation was resolved manually
```

---

# 169. Financial Audit Must Identify Actual Actor

Audit includes:

- actor identity;
- identity type;
- tenant;
- session where applicable;
- initiating identity;
- operation;
- correlation ID.

---

# 170. Provider Credentials Do Not Enter Financial Audit

Audit records credential reference/provider identity, never secrets.

---

# 171. Ledger History Is Append-Only

Runtime roles must not update or delete posted Ledger Entries.

---

# 172. Voucher History Is Immutable

Issued Voucher financial specification is append/immutable state.

Cancellation/expiry is separate lifecycle evidence.

---

# 173. Invoice Correction Is Explicit

If a fiscal/business Invoice must be corrected:

```text
correction document
credit note
replacement
```

or jurisdiction-specific equivalent is preferred over silently rewriting historical values.

---

# 174. Commercial Persistence Is Relational

Governance-critical financial facts must not be hidden only inside JSONB.

Examples include:

- amount;
- currency;
- status;
- buyer;
- payer;
- Voucher line;
- Ledger account;
- Payment relation;
- Refund relation;
- settlement relation.

---

# 175. Provider Payload Snapshot May Use JSONB

External payment/fiscal payload snapshots may use protected JSONB where appropriate.

Provider payload is evidence.

It is not canonical financial schema.

---

# 176. Financial Writes Prefer Strong Database Transactions

Critical operations such as:

- Ledger posting;
- Wallet transfer;
- Voucher finalization;
- Refund posting;
- Settlement posting

are candidates for data-local Stored Procedures/Functions where this improves atomicity and concurrency safety.

---

# 177. Database Routine Does Not Authorize

Financial Stored Procedures receive already-authorized operations.

They enforce data integrity.

They do not interpret application Roles or privileges.

---

# 178. Financial Concurrency Is Explicit

Critical operations must handle:

- duplicate callback;
- simultaneous spend;
- duplicate Refund;
- concurrent settlement;
- reservation contention.

---

# 179. Balance Check and Posting Are Atomic

Forbidden:

```text
read balance
    ↓
application checks
    ↓
later update
```

when concurrent operations can overspend.

---

# 180. Wallet Spend Uses Locking or Equivalent Concurrency Control

Financial persistence owns deterministic concurrency behavior.

---

# 181. Idempotency Exists at Every Retryable Financial Boundary

Important examples:

```text
Voucher issuance
Financial Transaction creation
Payment callback
Wallet transfer
Refund
Fulfillment dispatch
Settlement
Payout
external reseller purchase
```

---

# 182. Idempotency Key Has Scope

The same string may only be meaningful within an explicit operation/tenant/actor scope.

Idempotency identity must not collide across unrelated operations.

---

# 183. Same Key, Different Request Is Conflict

Canonical behavior:

```text
same idempotency key
+
same fingerprint
→ same logical result
```

but:

```text
same key
+
different fingerprint
→ IDEMPOTENCY_CONFLICT
```

---

# 184. Idempotency Is Durable

Process restart must not forget completed financial idempotency state.

---

# 185. Exactly-Once External Payment Is Not Assumed

Platform correctness is designed around:

- idempotency;
- reconciliation;
- provider correlation;
- immutable Ledger effects.

---

# 186. Financial Transaction Can Be UNKNOWN

External provider uncertainty is represented explicitly.

Do not collapse:

```text
UNKNOWN
```

into:

```text
FAILED
```

for UX convenience.

---

# 187. Reconciliation Is Shared Infrastructure With Financial Ownership

The generic Reconciliation capability coordinates unresolved work.

Financial Core owns the meaning of final Payment/Transaction state.

---

# 188. Reconciliation May Need Operator Review

Some unresolved cases cannot be resolved automatically.

Manual resolution requires:

- Authority;
- reason;
- evidence;
- audit.

---

# 189. Suspense Is Supported Where Required

Financial architecture may use explicit suspense/intermediate accounts or states for unresolved financial effects where accounting design requires it.

Suspense must not become a generic hiding place for inconsistent data.

---

# 190. Recovery After Database Restore Requires Reconciliation

After PITR, external providers may contain newer facts than restored PostgreSQL.

Commercial recovery must check:

- Payments;
- Refunds;
- Payouts;
- fiscal submissions;
- service Fulfillments.

---

# 191. Blind Replay After Restore Is Prohibited

Outbox/Jobs restored to a pre-completion state may represent actions that already happened externally.

Use idempotency/provider lookup/Reconciliation.

---

# 192. Fulfillment Dispatch Survives Restore

Financial finality without recorded service activation must be recoverable.

---

# 193. Financial Backup Has Strong Recovery Priority

Commercial Ledger/Voucher/Transaction state is authoritative and must participate in the deployment's high-priority backup/RPO policy.

---

# 194. Qdrant Is Not Involved in Financial Truth

Commercial operations must not depend on semantic index state for financial correctness.

---

# 195. AI Does Not Own Financial Decisions

AI may support:

```text
invoice explanation
support summarization
anomaly suggestion
```

It must not independently:

- calculate authoritative payable amount;
- post Ledger;
- approve Refund;
- change Wallet;
- issue payout.

---

# 196. AI Output Is Advisory Unless Explicitly Validated

Any AI-assisted commercial workflow passes through deterministic application rules before authoritative state changes.

---

# 197. Pricing Is Not Generated by LLM

Canonical price/discount/tax values come from deterministic commercial/financial policies.

---

# 198. Notification Is Separate From Financial Truth

Payment success may request:

```text
payment.confirmed
```

Notification delivery failure does not make the Payment unsuccessful.

---

# 199. Ticketing May Reference Commercial Resources

Support Tickets may link to:

```text
Voucher
Payment
Purchase Projection
Invoice
Refund
Settlement
```

through stable Resource References.

Ticketing never mutates financial tables directly.

---

# 200. Data Governance Applies to Commercial Data

Payment and Invoice data may contain:

- identity;
- contact details;
- legal data;
- financial data.

External provider payloads, exports, logs, backups, and SOC telemetry obey governance policy.

---

# 201. Payment Provider Receives Minimum Necessary Data

Provider adapters should send only required fields.

Commercial access does not authorize unnecessary data disclosure.

---

# 202. Commercial Data Export Is Explicit

Bulk financial export requires dedicated Authority operation and audit.

Ordinary list/read privilege is not automatically export privilege.

---

# 203. Commercial Lists Follow Shared Query Rules

Single resource:

```text
GET /purchases/{id}
```

List:

```text
GET /purchases
```

are separate contracts.

---

# 204. Commercial Lists Do Not Count by Default

Default:

```text
items
nextCursor / hasMore
```

`total` is computed only when explicitly requested.

---

# 205. Count Uses Authorized Result Set

A user authorized for 20 Purchases must not receive a total count of 5,000 tenant purchases.

---

# 206. Financial Search Does Not Leak Hidden Existence

Authorization errors and counts must not reveal confidential transactions outside the actor's scope.

---

# 207. Catalog Lists May Use Different Performance Semantics

Catalog is a discovery projection and may support cache/materialized views.

Financial Transaction lists require authoritative security and consistency appropriate to their state.

---

# 208. Dashboard Commercial Views Are Projections

User Dashboard may display:

- active packages;
- Wallet;
- credits;
- Purchases;
- Invoices;
- Usage.

These views aggregate canonical owners.

Dashboard itself owns no financial truth.

---

# 209. Wallet Display Balance Comes From Financial Projection

Frontend must not maintain authoritative balance through local arithmetic.

---

# 210. Entitlement Display Comes From Service Domain

Commercial Dashboard may aggregate it through public contracts.

It must not infer current entitlement merely from historical purchase success.

---

# 211. Expired Product Does Not Delete Purchase History

When an Offering is retired or Product no longer sold:

- historical Vouchers remain;
- Invoice remains;
- Ledger remains;
- Entitlement follows its own lifecycle.

---

# 212. Offering Deactivation Prevents New Purchase

Deactivation does not invalidate already issued valid Vouchers unless their contract explicitly permits revocation.

---

# 213. Product Retirement Is Controlled

A Product with historical transactions must not be physically removed merely because sales stop.

Use lifecycle state.

---

# 214. Commercial Delete Is Soft by Default

Normal business records use historical retention.

Hard deletion requires explicit governance/legal workflow.

---

# 215. Ledger Is Never Ordinary Soft-Deleted

Immutable financial Ledger history is append-only.

Correction is additive.

---

# 216. Financial Transaction Records Are Preserved

Ordinary cancellation changes state.

It does not physically delete history.

---

# 217. Provider Attempt History Is Retained According to Policy

Sensitive payloads may be minimized/redacted.

Correlation IDs and outcomes remain sufficient for investigation.

---

# 218. Commercial Events Are Facts

Examples:

```text
commercial.voucher.issued
commercial.transaction.succeeded
commercial.payment.confirmed
commercial.refund.completed
commercial.settlement.completed
commercial.fulfillment.requested
```

Events are emitted after the corresponding fact becomes durable.

---

# 219. `PaymentSucceeded` Is Not Emitted Early

Never emit a success fact while Payment is only:

```text
PROCESSING
UNKNOWN
```

---

# 220. Financial Event Publication Is Durable

Critical financial events use transactional outbox or equivalent durable publication.

---

# 221. Consumers Cannot Rewrite Financial Fact

A service failing to process:

```text
commercial.transaction.succeeded
```

does not change the Financial Transaction back to failed.

---

# 222. Fulfillment Events Have Separate Ownership

Service Domain emits facts such as:

```text
widget.entitlement.activated
```

Commercial may update its purchase projection from these events.

---

# 223. Event Duplication Is Expected

Consumers are idempotent.

A repeated financial event must not create repeated Entitlement.

---

# 224. Event Ordering Assumptions Are Explicit

If one consumer requires ordering for a specific aggregate, that requirement must be encoded through version/state checks.

Do not assume global event ordering.

---

# 225. Commercial Health Distinguishes Subsystems

Possible health dimensions:

```text
Financial DB
Payment Provider
Fiscal Provider
Fulfillment Backlog
Settlement
```

A fiscal-provider outage may degrade invoice submission without making internal financial truth unavailable.

---

# 226. Payment Provider Outage Is Degraded State

Existing Purchase/Invoice/Wallet reads may remain available.

New external Payments may be unavailable.

---

# 227. Financial Core Availability Is Critical When Commercial Is Enabled

Authoritative money mutation fails closed if Financial Core cannot guarantee correctness.

---

# 228. Commercial Disabled Removes Commercial Surfaces

When Commercial capability is disabled:

- no checkout;
- no Wallet UI;
- no purchase Catalog unless used in non-commercial mode;
- no commercial API operations.

Business modules remain available according to enterprise policy.

---

# 229. Commercial Disablement Does Not Delete Financial History

Disabling the capability in a deployment with historical financial data requires explicit retention/access strategy.

---

# 230. Financial Runtime Roles Are Least-Privileged

Higher-assurance deployments may use a more restricted Financial database/application role for sensitive persistence operations.

---

# 231. Financial Procedures Are Protected

Runtime code unrelated to Financial Core must not directly invoke Financial Stored Procedures.

---

# 232. Cross-Module Financial Table Access Is Prohibited

Business modules consume Commercial/Financial public contracts.

They never query:

```text
commercial.tbl_...
```

directly.

---

# 233. Commercial Core Never Queries Private Module Tables

Product/Offering/Fulfillment information is obtained through public service contracts.

---

# 234. No Cross-Domain Foreign-Key Dependency Is Required

A Voucher line may store stable external Product/Offering identifiers and immutable snapshots without creating database ownership coupling to module-private tables.

---

# 235. Identifier and Snapshot Are Both Useful

Stable Product ID supports correlation.

Snapshot fields preserve historical meaning.

Neither alone is sufficient for every requirement.

---

# 236. Signed Cross-Domain Commitments May Be Used

Where service and Financial boundaries require stronger independence, a service commitment may be canonicalized and cryptographically signed.

This is especially useful across process/deployment boundaries.

---

# 237. Signatures Prove Issuer Integrity

A signature proves that the owning Service issued the commitment.

It does not by itself prove:

- buyer authorization;
- current validity after expiry;
- Payment success;
- Fulfillment.

---

# 238. Signed Commitment Has Key Identity and Version

Where signing is used, payload contains or references:

- issuer;
- key ID;
- algorithm;
- canonicalization version;
- issued time;
- expiry.

---

# 239. Signing Keys Are Rotatable

Verification must support the approved key lifecycle without invalidating still-valid historical evidence unexpectedly.

---

# 240. In-Process Deployment May Still Use the Same Contract

Cryptographically signed payloads are not mandatory solely because two owners run in one process.

The semantic ownership boundary remains the same.

---

# 241. Commercial API Uses Stable Errors

Possible errors include:

```text
OFFERING_NOT_AVAILABLE
PURCHASE_NOT_ALLOWED
PRICE_CHANGED
RESERVATION_UNAVAILABLE
VOUCHER_EXPIRED
PAYMENT_REQUIRED
PAYMENT_DECLINED
PROVIDER_RESULT_UNKNOWN
RECONCILIATION_REQUIRED
INSUFFICIENT_FUNDS
REFUND_NOT_ALLOWED
FULFILLMENT_PENDING
```

Human messages are separate.

---

# 242. Provider Errors Do Not Escape Raw

Raw bank/payment/fiscal error text remains internal unless deliberately mapped to safe user-facing information.

---

# 243. Price Change Is Explicit

If a Saved Cart price differs from current purchase preparation:

```text
PRICE_CHANGED
```

or equivalent explicit checkout result is preferable to silently charging the new amount.

---

# 244. Client Confirms Final Voucher

Where UX requires buyer confirmation, confirmation applies to the final Voucher specification, not stale Cart values.

---

# 245. Voucher Fingerprint Supports Integrity

A canonical digest/fingerprint may help detect that the confirmed Voucher is exactly the one presented to the client.

---

# 246. Client Cannot Authoritatively Submit Total

The server/Financial Core calculates authoritative totals from trusted commitments and policies.

Client-provided totals are informational/untrusted.

---

# 247. Client Cannot Submit Ledger Entries

Ledger posting plans are created by trusted Financial logic.

---

# 248. Client Cannot Select Internal Financial Account

Public APIs must not expose arbitrary internal Ledger account identifiers as controllable posting targets.

---

# 249. Financial Calculations Are Deterministically Testable

Given identical:

- Voucher inputs;
- Money values;
- rates;
- tax rules;
- discount rules;

the Financial Kernel produces identical results.

---

# 250. Clock Is Explicit in Financial Kernel

Expiry/time-dependent calculation receives current time explicitly.

Pure financial logic does not call wall clock itself.

---

# 251. Random IDs Are Outside Pure Financial Kernel

Identifiers are generated by application/composition infrastructure and supplied explicitly.

---

# 252. Commercial Tests Begin With Invariants

Preferred sequence:

```text
Contracts
    ↓
Financial / Commercial Invariant Tests
    ↓
Persistence / Concurrency Tests
    ↓
Provider Contract Tests
    ↓
Application Implementation
    ↓
End-to-End Tests
```

---

# 253. Product/Offering Ownership Tests Are Mandatory

Tests prove:

- Product belongs to service owner;
- Offering belongs to service owner;
- Catalog is projection;
- Financial Core cannot invent Product semantics.

---

# 254. Cart Tests Are Mandatory Where Cart Exists

Tests cover:

- add;
- remove;
- stale Offering;
- price change;
- unavailable Product;
- no reservation at cart time.

---

# 255. Voucher Preparation Tests Are Mandatory

Tests cover:

- all lines valid;
- one line invalid;
- expired commitment;
- price mismatch;
- reservation failure;
- discount;
- tax;
- zero-value transaction;
- exact totals.

---

# 256. Voucher Immutability Tests Are Mandatory

After issue:

- lines cannot mutate;
- amount cannot mutate;
- currency cannot mutate;
- description snapshot cannot mutate.

Cancellation creates lifecycle state, not mutation of financial specification.

---

# 257. Money Tests Are Mandatory

Tests cover:

- integer-only authoritative values;
- currency mismatch;
- rounding;
- allocation residual;
- negative values;
- large amounts;
- conversion.

---

# 258. Ledger Tests Are Mandatory

Tests prove:

- balanced posting;
- atomic posting;
- immutable entries;
- correction by additive entry;
- reconstructable balance.

---

# 259. Wallet Concurrency Tests Are Mandatory

Simultaneous spending must not overspend beyond policy.

---

# 260. Payment Tests Are Mandatory

Tests cover:

- initiation;
- callback;
- duplicate callback;
- declined payment;
- timeout;
- unknown outcome;
- reconciliation;
- wrong amount;
- wrong currency;
- wrong provider reference.

---

# 261. Refund Tests Are Mandatory

Tests cover:

- full Refund;
- partial Refund;
- duplicate request;
- over-refund prevention;
- provider failure;
- UNKNOWN;
- Ledger correctness.

---

# 262. Transfer Tests Are Mandatory

Tests cover:

- insufficient funds;
- same source/destination invalidity where applicable;
- concurrent transfer;
- retry;
- reversal.

---

# 263. Fulfillment Tests Are Mandatory

Tests cover:

- financial success;
- durable dispatch;
- service success;
- retry;
- duplicate event;
- service failure;
- UNKNOWN;
- operator recovery.

---

# 264. Payment/Fulfillment Separation Is Tested

Tests must explicitly prove:

```text
Payment = succeeded
Fulfillment = failed
```

does not corrupt either domain.

---

# 265. Entitlement Tests Are Service-Owned

Each service module tests:

- creation;
- duplicate Fulfillment;
- expiry;
- suspension;
- Usage;
- revocation.

Commercial integration tests verify the public contract.

---

# 266. Usage-Rating Tests Are Mandatory Where Used

Tests cover:

- duplicate Usage;
- pricing version;
- threshold/tier;
- period boundary;
- exact charge;
- no float arithmetic.

---

# 267. Subscription Tests Are Mandatory Where Used

Tests cover:

- initial acquisition;
- renewal;
- non-renewal;
- cancellation;
- failed renewal;
- entitlement end;
- duplicate renewal callback.

---

# 268. Bundle Tests Are Mandatory

Tests cover:

- all components prepare;
- one component fails;
- reservation compensation;
- all components fulfill;
- partial Fulfillment;
- recovery;
- Refund allocation.

---

# 269. Reseller Tests Are Mandatory Where Enabled

Tests cover:

- reseller catalog;
- reseller-specific terms;
- machine identity;
- downstream customer;
- external order correlation;
- duplicate retry;
- settlement;
- payout UNKNOWN.

---

# 270. Settlement Tests Are Mandatory

Tests cover:

- eligible source transactions;
- currency;
- period boundary;
- commission;
- duplicate execution;
- correction;
- payout linkage.

---

# 271. Financial Authorization Tests Are Mandatory

Tests include:

- ordinary buyer;
- tenant operator;
- refund operator;
- settlement operator;
- unauthorized user;
- cross-tenant attempt;
- break-glass where permitted.

---

# 272. High-Risk Operation Tests Include Strong Authentication

Where policy requires it, tests prove weak authentication cannot perform:

- large Refund;
- payout;
- manual adjustment;
- settlement approval.

---

# 273. Recovery Tests Are Mandatory

Tests cover process crash:

- before financial commit;
- after Ledger commit but before response;
- after payment success before event dispatch;
- during Fulfillment;
- during Refund;
- during settlement.

---

# 274. Post-Restore Reconciliation Tests Are Mandatory

Representative restore scenarios must prove external effects are not duplicated.

---

# 275. Provider Fault Injection Is Mandatory

Tests include:

```text
timeout
429
500
malformed callback
duplicate callback
provider says UNKNOWN
connection loss after request submission
```

---

# 276. Migration Tests Preserve Financial History

Schema migrations must not silently:

- change amounts;
- change currencies;
- remove Ledger entries;
- rewrite Voucher semantics.

---

# 277. Query Tests Follow List/Count Rules

Commercial list endpoints must prove:

- no automatic total;
- authorized count only;
- efficient pagination.

---

# 278. Financial Query Plans Are Reviewed

High-volume transaction/Ledger queries use representative PostgreSQL plan analysis.

---

# 279. Architecture Tests Prevent Financial Bypass

CI should reject detectable patterns such as:

```text
business module directly updates Wallet
business module inserts Ledger entry
controller calculates authoritative Money
float used for authoritative Money
provider SDK imported into Financial persistence
direct cross-module commercial table access
```

---

# 280. Architecture Tests Protect Service Ownership

Commercial Core must not import private:

```text
Widget
CRM
Secretariat
Letter Assistant
Follow-up
```

domain implementations.

---

# 281. Architecture Tests Protect Fulfillment Ownership

Financial Core must not create service Entitlements directly.

---

# 282. Architecture Tests Protect Authority Boundary

Commercial code must not:

- interpret Role;
- inspect `ALL`;
- interpret CRUD privilege tree;
- implement local ACL.

Authority remains canonical.

---

# 283. Commercial Is Horizontally Scalable

API/Worker replication must not rely on process-local:

- idempotency;
- Wallet lock;
- financial finality;
- settlement state;
- fulfillment retry state.

---

# 284. Financial Correctness Precedes Availability

If Financial Core cannot establish authoritative correctness:

```text
fail closed
```

is preferred over accepting uncertain money mutation.

---

# 285. Read-Only Degradation May Be Supported

During selected provider outages, safe read operations may remain available while mutation paths are disabled/degraded.

---

# 286. Operator Dashboards Surface Unresolved States

Commercial administration should surface:

- UNKNOWN Payments;
- failed Fulfillment;
- reconciliation backlog;
- unsettled amounts;
- failed payouts;
- provider health.

Such states must not remain hidden only in logs.

---

# 287. Manual Resolution Is Explicit

Operator actions resolving exceptional commercial states require:

- Authority;
- reason;
- evidence;
- audit;
- stable resolution outcome.

---

# 288. Manual Database Edits Are Prohibited

Operational staff must not resolve Payment/Wallet/Ledger inconsistencies using ad-hoc SQL against production.

Controlled application/maintenance workflows are required.

---

# 289. Commercial Metrics Are Structured

Useful operational metrics include:

```text
Voucher issuance
Payment success/failure
UNKNOWN Payment count
Reconciliation backlog
Fulfillment backlog
Refund rate
Settlement backlog
Provider latency
```

---

# 290. Financial Metrics Do Not Replace Ledger

Dashboard aggregates are derived.

Financial truth remains transactional persistence/Ledger.

---

# 291. Sensitive Financial Data Is Not Metric Label

Do not use:

- card/account information;
- invoice content;
- customer names;
- Voucher IDs at uncontrolled cardinality

as metric labels.

---

# 292. SOC Receives Security Events, Not Full Financial Replication

Security Telemetry may include:

- unauthorized Refund attempt;
- high-risk admin change;
- payment callback signature failure;
- unusual break-glass usage.

SOC export must not indiscriminately copy financial records.

---

# 293. Financial Audit Has Explicit Retention

Generic operational log cleanup must never purge Ledger or required financial evidence.

---

# 294. Invoice/Financial Retention Follows Legal and Deployment Policy

No universal fixed retention period is encoded in application code.

---

# 295. Financial Purge Is Exceptional

Where law permits/mandates deletion, purge requires dedicated governance and must preserve required accounting evidence.

---

# 296. Commercial Configuration Is Versioned

Important configuration includes:

- operator;
- supported currencies;
- payment adapters;
- fiscal adapters;
- settlement policies;
- enabled commercial modes.

Changes are auditable.

---

# 297. Payment Provider Configuration Is Deployment/Tenant Policy

Where supported, tenants/operators may use different payment providers through adapters.

Modules remain unchanged.

---

# 298. Commercial Provider Secrets Are Externalized

Payment/fiscal credentials use Secret references.

---

# 299. Provider Rotation Is Supported

Credential rotation must not lose correlation with in-flight provider transactions.

---

# 300. Final Commercial Rule

The Commercial architecture follows these rules:

```text
Commercial is optional.

Business modules work without Commerce where product policy allows it.

Service Domain owns Product meaning.

Service Domain owns Offering / Sellable truth.

Product describes what is acquired.

Offering describes how it is sold.

Only an Offering is purchasable.

Catalog is a projection.

Saved Cart is convenience state, not financial truth.

Cart does not reserve inventory.

Finite reservation belongs to the Service Domain.

Reservation occurs during purchase/Voucher preparation.

Transaction Voucher is the immutable transaction specification.

Historical transactions never reprice from current Offering data.

Zero-value purchase still has explicit transaction evidence.

Financial Transaction executes a Voucher.

Payment and Financial Transaction are distinct.

Payment and Fulfillment are distinct.

Financial success does not prove service activation.

Service Fulfillment is durable and idempotent.

Entitlement belongs to the Service Domain.

Usage meaning belongs to the Service Domain.

Usage Accounting is not Financial Accounting.

Financial Core owns Money calculation.

Authoritative Money never uses floating point.

Currency is explicit.

Exchange-rate input is explicit and historically retained.

Ledger Entries are immutable.

Wallet balance derives from Ledger.

Corrections are additive.

Service credit is not automatically Money.

Refund does not delete original history.

Refund and Reversal are distinct.

Invoice derives from immutable transaction facts.

Invoice does not source historical data from the current Catalog.

A generic Order/Purchase view may exist as a projection.

There is no universal Order lifecycle collapsing payment and fulfillment.

Bundles preserve component identity and allocation.

Bundle preparation uses reservation/commit coordination.

Resellers are commercial actors, not implicit Authority roles.

Reseller machine credentials remain machine identities.

External storefront truth remains external.

Settlement is separate from customer purchase.

Payout is separate from settlement.

Operator, Tenant, Buyer, Payer, Beneficiary, and Actor are distinct concepts.

Authority is consumed, never reimplemented.

High-risk operations may require strong authentication or dual control.

Retryable financial operations are durable and idempotent.

UNKNOWN external outcomes are first-class.

UNKNOWN payment or payout is never blindly retried.

Reconciliation resolves uncertain external state.

Post-restore external effects are reconciled before replay.

Financial audit is layered and append-oriented.

Financial persistence is relational and concurrency-safe.

Business modules never mutate Financial tables directly.

Financial Core never mutates service Entitlement tables directly.

Cross-domain collaboration uses explicit contracts.

AI does not own financial decisions.

Notifications do not define financial state.

Ticketing may reference but never mutate Commercial truth.

Commercial state is recoverable, scalable, auditable, and directly tested.
```

The default Commercial-design question is:

> **Who owns what is being sold, which immutable specification fixes the transaction terms, which component owns the money, which service owns the resulting entitlement, what remains true when payment or fulfillment becomes uncertain, and which Ledger, audit, idempotency, and reconciliation evidence proves that no financial effect was lost or duplicated?**