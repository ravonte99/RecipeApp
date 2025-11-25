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
