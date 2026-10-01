# Commercial / Financial Agent Instructions

Inherit `/AGENTS.md`.

Owns reusable commercial transaction mechanics and financial truth; service modules retain service meaning.

## Required

- Service modules own Product/Offering/reservation/Entitlement/Fulfillment/Usage meaning.
- Product is not directly purchasable; Offering/Sellable is.
- Cart is convenience state and does not reserve.
- Transaction Voucher is immutable after issue.
- Money is integer atomic amount + currency.
- Ledger entries are immutable; corrections are additive; Wallet balance derives from Ledger.
- Payment and Fulfillment are independent.
- Use durable idempotency and Reconciliation for UNKNOWN payment/payout/fulfillment.
- Keep critical financial writes atomic/concurrency-safe.

## Forbidden

- Float authoritative Money.
- Modules directly changing Wallet/Ledger.
- Financial Core directly mutating service Entitlement.
- Historical repricing from current Offering.
- AI authoritative financial decisions.
