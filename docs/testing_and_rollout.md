# Testing and Rollout Plan

## Automated test coverage

### Unit tests: parsing and normalization
- **Scope:** JSON prompt schemas, deterministic settings, and numeric handling for ingredient parsing and unit normalization flows defined in `src/data/assistantPrompts.js`.
- **Approach:**
  - Validate required fields, deterministic flags, and schema shape for `ingredientParsing` and `unitNormalization` prompts.
  - Exercise normalization helpers for edge cases (fractions, pluralization, density gaps) with table-driven tests.
  - Guard against regressions in required keys (`normalized_quantity`, `normalized_unit`, `rationale`) and value ranges (e.g., `temperature=0`).
- **Tooling:** Node.js unit tests with `node:test` mirroring the existing API test harness; fast-running and isolated from network or sandbox dependencies.

### Integration tests: sandbox retailer APIs
- **Scope:** `RetailerService` flows in `src/services/retailerService.js` and HTTP handlers in `src/server.js`.
- **Approach:**
  - Spin up the local HTTP server on an ephemeral port and exercise `GET /api/stores`, `GET /api/products/search`, `POST /api/cart`, item append, and checkout URL generation.
  - Assert SKU validation, fallback generation for missing/out-of-stock SKUs, subtotal math, and propagation of store metadata (zipcode, handoff domains).
  - Add negative coverage for invalid store IDs and cart IDs to mirror sandbox behaviors.
- **Tooling:** Black-box API tests (similar to `tests/api.test.js`) that can be run locally and in CI without external network calls.

### UI tests: planner and cart flow
- **Scope:** SwiftUI client covering weekly planner, recipe picker/importer, grocery list review, and checkout handoff screens.
- **Approach:**
  - Use XCTest UI tests with deterministic fixtures for recipes and mock retailer responses (served via local stub server or `RetailerService` mock).
  - Validate planner interactions: add/remove recipes, adjust servings, and verify aggregated grocery lists match scaled ingredients.
  - Validate cart interactions: product substitutions surfaced, totals update when items are toggled, and checkout handoff deep links open correctly.
  - Run on iOS 17 simulators with parallelizable test plans for smoke vs. full suites.

## Rollout strategy

### Beta via TestFlight
- Ship the planner-to-cart flow to a private TestFlight group (internal + select external) with release notes focusing on grocery partner coverage and manual checkout requirement.
- Require crash reporting and analytics (engagement funnels for planner, cart review, and checkout handoff) before expanding cohorts.

### Feature flags by retailer
- Gate retailer-specific integrations (e.g., Kroger vs. future partners) behind remote-config flags.
- Default to Kroger-only during beta; gradually enable additional retailers per region or cohort after sandbox parity is confirmed by integration tests.
- Include kill-switch flags to disable cart creation or checkout handoff independently if partner SLAs regress.

### Exit criteria for broader launch
- Green CI for unit + integration tests across back-end and passing baseline SwiftUI UI suite.
- No P0/P1 crashers in TestFlight for 7 consecutive days; cart checkout success rate within target range.
- Observability dashboards in place for API latency, fallback rates, and feature-flagged retailer performance.
