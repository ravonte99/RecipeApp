# RecipeApp

## Scope Confirmation
- **Recipe sources:** Support both curated in-app recipes and user-imported URLs. Imported links are parsed into structured recipes and saved alongside curated content for reuse.
- **Weekly meal planning:** Default plan covers **7 meals per week** with a default of **4 servings per meal**; both numbers are user-editable per week or per recipe.

## Grocery Partner API Decision
- **Primary partner:** Kroger Product Search & Cart APIs (broad US coverage, item availability, and pricing).
- **Authentication:** Authorization Code with PKCE via user OAuth. Tokens are obtained client-side, exchanged with backend for storage/refresh, and Kroger access tokens are used server-to-server for product search, SKU normalization, and cart creation.

## User Journey
1. **Select recipes** – user adds curated or imported recipes to the weekly plan (default 7 slots, adjustable servings).
2. **Generate ingredients** – app aggregates ingredient lists by recipe and scales quantities to selected servings.
3. **Normalize to SKUs** – backend maps normalized ingredients to Kroger product SKUs (per store/zipcode) using search + substitution rules.
4. **Review cart** – user reviews mapped items, substitutes or removes products, and sees cost estimates.
5. **Checkout handoff** – backend creates a Kroger cart and hands off the cart/redirect URL for final payment within the partner flow.
