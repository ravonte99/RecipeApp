# Retailer API evaluation

This backend models the core Kroger retail API surfaces the app relies on for grocery carts. The endpoints focus on:

- **Cart creation** – Build a store-scoped cart, validate SKUs, and capture pricing/availability snapshots.
- **Item search** – Query store catalogs by keyword or brand with ZIP-aware store selection.
- **Inventory/price availability** – Each product includes `inStock`, `inventory`, and `price` so the UI can pre-empt failures.
- **Substitutions** – When a SKU is unavailable, the API suggests up to three in-stock alternatives in the same category and flags that manual edits are allowed.
- **Checkout handoff/deeplink** – The `/checkout` endpoint returns a retail web URL plus a custom deep link that the iOS app can open directly.
- **Assistant guardrails** – Automatic purchasing is not supported; the assistant can only stage carts and provide links for the user to finish checkout.

## Data assumptions
- Stores are keyed by zipcode for discovery; once a store is chosen, all cart and catalog calls stay scoped to that store.
- Catalog entries contain pricing, inventory, and category metadata to drive substitution logic.
- Carts are kept in-memory for now; the structure matches what a persistent implementation would store (items, fallbacks, totals, timestamps).

## Open items for a production integration
- Replace the static catalog with live Kroger product search endpoints and OAuth-protected calls to price/availability APIs.
- Persist carts with user bindings and refresh inventory/price when checking out.
- Expand substitution scoring with embeddings or historical user picks, and localize manual-edit prompts in the client.
- Harden request validation, rate limits, and auditing once external API credentials are involved.
