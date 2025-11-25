# RecipeApp

## Client and Backend Stack
- **Client**: Native **SwiftUI** iOS app targeting iOS 17+ for modern UI components, async/await networking, and on-device caching.
- **Backend**: Lightweight **Node.js (Express)** or **Fastify** service deployed behind HTTPS. Responsibilities:
  - Proxy OpenAI requests with server-side API key management.
  - Store encrypted retailer API tokens and user auth credentials (e.g., via PostgreSQL + KMS-managed encryption keys).
  - Provide endpoints for recipe CRUD, meal plans, shopping carts, and retailer SKU lookups.
  - Rate-limiting, auditing, and observability (structured logs + traces) to guard model usage.

## Core Data Models
- **Recipe**
  - `id`, `title`, `description`, `instructions` (ordered steps), `servings`, `prepTimeMinutes`, `cookTimeMinutes`.
  - `ingredients: [IngredientRequirement]` (ingredient + quantity per recipe), `tags` (cuisine, dietary), `imageUrl`, `sourceUrl`.
- **Ingredient** (normalized pantry catalog)
  - `id`, `name` (canonical), `category` (produce, dairy, spice, etc.), `normalizedUnit` (grams, milliliters, pieces), `density` (g/mL) when applicable, `aliases`.
- **IngredientRequirement** (per recipe)
  - `ingredientId`, `originalText`, `quantity` (decimal), `unit` (normalized), `preparationNote` (e.g., “chopped”).
- **ShoppingItem** (retailer SKU mapping)
  - `id`, `ingredientId`, `retailer` (e.g., Instacart, Amazon Fresh), `sku`, `name`, `packageSize`, `unit`, `price`, `inStock`.
- **MealPlan**
  - `id`, `userId`, `startDate`, `endDate`, `entries: [{date, mealType, recipeId, servings}]`, `notes`.
- **GroceryCart**
  - `id`, `userId`, `retailer`, `items: [{shoppingItemId, quantity, unit, recipeContext}]`, `subtotal`, `currency`, `status`.

## OpenAI Prompts & Functions
### Ingredient Extraction
- **Prompt goal**: Convert free-text recipe into structured ingredients.
- **System prompt**: “You are a culinary parser that extracts ingredients with quantities and normalized units. Use metric units where possible.”
- **Function call**: `extract_ingredients(recipe_text)` returning `{ ingredients: [{ original_text, ingredient_name, quantity, unit, preparation_note }] }`.
- **Post-processing**: Backend maps `ingredient_name` to catalog `Ingredient` using embeddings/alias matching; unresolved names flagged for human review.

### Quantity Normalization
- **Prompt goal**: Normalize mixed units (cups, teaspoons) to standard grams/milliliters/pieces using density when provided.
- **Function call**: `normalize_quantity(ingredient_name, quantity, unit, density_g_per_ml?)` returning `{ normalized_quantity, normalized_unit, rationale }`.
- **Guidelines**: Prefer grams for solids, milliliters for liquids; keep original if mapping uncertain and mark `rationale`.

### Substitution Suggestions
- **Prompt goal**: Suggest dietary/allergy substitutions preserving flavor and function.
- **Function call**: `suggest_substitutions(ingredient_name, recipe_context, dietary_constraints)` returning `{ substitutions: [{ name, reason, ratio, notes }] }`.
- **System behaviors**: Respect constraints (vegan, gluten-free, nut-free), keep ratios simple, flag cases where no suitable swap exists.

### Safety & Cost Controls
- Temperature-check all model outputs; reject if quantities or units are missing.
- Cache high-traffic prompts (ingredient extraction) with request hashing.
- Enforce max-tokens and strict schemas to limit hallucinations and spending.
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
