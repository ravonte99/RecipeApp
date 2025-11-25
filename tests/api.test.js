const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer } = require('../src/server');

let server;
let baseUrl;

before(() => {
  server = startServer(0);
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(() => {
  server.close();
});

test('exposes assistant capabilities without auto-purchasing', async () => {
  const res = await fetch(`${baseUrl}/api/assistant/capabilities`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.automaticShopping, false);
  assert.ok(body.supportedFlows.includes('cart_building'));
  assert.ok(body.unsupportedFlows.includes('auto_purchase'));
});

test('returns prompts and guardrails for the assistant', async () => {
  const promptsRes = await fetch(`${baseUrl}/api/assistant/prompts`);
  assert.strictEqual(promptsRes.status, 200);
  const prompts = await promptsRes.json();
  assert.ok(prompts.ingredientParsing);
  assert.strictEqual(prompts.unitNormalization.deterministicResponse.max_output_tokens, 220);

  const guardrailsRes = await fetch(`${baseUrl}/api/assistant/guardrails`);
  assert.strictEqual(guardrailsRes.status, 200);
  const guardrails = await guardrailsRes.json();
  assert.strictEqual(guardrails.tokenLimits.requestMaxTokens, 2800);
  assert.ok(Array.isArray(guardrails.retryPolicy.retryableStatusCodes));
});

test('searches products by zipcode and keyword', async () => {
  const res = await fetch(`${baseUrl}/api/products/search?zipcode=94103&query=milk`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.ok(body.products.length > 0);
  assert.ok(body.products.every((p) => p.name.toLowerCase().includes('milk')));
});

test('returns products across all stores when no filters provided', async () => {
  const res = await fetch(`${baseUrl}/api/products/search`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.ok(body.products.length > 0);
  const uniqueStoreIds = new Set(body.products.map((p) => p.storeId));
  assert.ok(uniqueStoreIds.size >= 2);
});

test('creates cart and surfaces substitution fallbacks', async () => {
  const res = await fetch(`${baseUrl}/api/cart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storeId: 'store-100',
      zipcode: '94103',
      items: [
        { sku: 'milk-1g', quantity: 1 },
        { sku: 'eggs-12', quantity: 1 },
        { sku: 'missing-sku', quantity: 1, category: 'dairy' },
      ],
    }),
  });

  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.ok(body.items.some((item) => item.sku === 'milk-1g'));
  assert.ok(body.fallbacks.length >= 1);
  assert.ok(body.totals.subtotal > 0);
});

test('adds items and returns checkout handoff links', async () => {
  const createRes = await fetch(`${baseUrl}/api/cart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeId: 'store-200', items: [{ sku: 'avocado-3', quantity: 1 }] }),
  });
  const cart = await createRes.json();

  const addRes = await fetch(`${baseUrl}/api/cart/${cart.id}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ sku: 'milk-1g', quantity: 1 }] }),
  });
  assert.strictEqual(addRes.status, 200);
  const updated = await addRes.json();
  assert.ok(updated.items.length >= 2);

  const checkoutRes = await fetch(`${baseUrl}/api/cart/${cart.id}/checkout`, { method: 'POST' });
  assert.strictEqual(checkoutRes.status, 200);
  const checkout = await checkoutRes.json();
  assert.ok(checkout.webUrl.includes('checkout'));
  assert.ok(checkout.deepLink.startsWith('retailer://checkout'));
});

test('surfaces recipe catalog and individual recipe details', async () => {
  const listRes = await fetch(`${baseUrl}/api/recipes`);
  assert.strictEqual(listRes.status, 200);
  const listBody = await listRes.json();
  assert.ok(Array.isArray(listBody.recipes));
  assert.ok(listBody.recipes.some((recipe) => recipe.id === 'recipe-italian-pasta'));

  const detailRes = await fetch(`${baseUrl}/api/recipes/recipe-chicken-tacos`);
  assert.strictEqual(detailRes.status, 200);
  const recipe = await detailRes.json();
  assert.strictEqual(recipe.title, 'Citrus Grilled Chicken Tacos');
  assert.ok(recipe.ingredients.length > 0);
});

test('creates a meal plan and aggregates a grocery list', async () => {
  const planRes = await fetch(`${baseUrl}/api/meal-plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startDate: '2024-04-01',
      entries: [
        { date: '2024-04-01', mealType: 'dinner', recipeId: 'recipe-italian-pasta', servings: 4 },
        { date: '2024-04-02', mealType: 'dinner', recipeId: 'recipe-veg-stirfry', servings: 3 },
      ],
    }),
  });
  assert.strictEqual(planRes.status, 201);
  const plan = await planRes.json();
  assert.strictEqual(plan.entries.length, 2);
  assert.strictEqual(plan.endDate, '2024-04-07');

  const planListRes = await fetch(`${baseUrl}/api/meal-plans`);
  assert.strictEqual(planListRes.status, 200);
  const planList = await planListRes.json();
  const storedPlan = planList.mealPlans.find((entry) => entry.id === plan.id);
  assert.ok(storedPlan);
  assert.strictEqual(storedPlan.endDate, '2024-04-07');

  const groceryRes = await fetch(`${baseUrl}/api/meal-plans/${plan.id}/grocery-list`);
  assert.strictEqual(groceryRes.status, 200);
  const list = await groceryRes.json();
  const aggregated = list.ingredients.find((item) => item.ingredient === 'garlic');
  assert.ok(aggregated);
  assert.ok(aggregated.quantity >= 9); // combines pasta and stir-fry garlic
});

test('returns 404 when grocery list is requested for a missing plan', async () => {
  const res = await fetch(`${baseUrl}/api/meal-plans/missing-plan/grocery-list`);
  assert.strictEqual(res.status, 404);
  const body = await res.json();
  assert.strictEqual(body.error, 'meal_plan_not_found');
});

test('aligns meal plan dates with entries to avoid scheduling conflicts', async () => {
  const planRes = await fetch(`${baseUrl}/api/meal-plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entries: [
        { date: '2024-06-12', mealType: 'dinner', recipeId: 'recipe-veg-stirfry', servings: 2 },
        { mealType: 'lunch', recipeId: 'recipe-italian-pasta', servings: 2 },
        { date: '2024-06-15', mealType: 'dinner', recipeId: 'recipe-chicken-tacos', servings: 3 },
      ],
    }),
  });

  assert.strictEqual(planRes.status, 201);
  const plan = await planRes.json();
  assert.strictEqual(plan.startDate, '2024-06-12');
  assert.strictEqual(plan.endDate, '2024-06-18');
  assert.ok(plan.entries.every((entry) => entry.date));

  const dates = plan.entries.map((entry) => entry.date);
  assert.ok(dates.includes('2024-06-12'));
  assert.ok(dates.includes('2024-06-15'));
  assert.deepStrictEqual([...dates].sort(), dates); // entries sorted chronologically
});

test('rejects meal plans without any valid recipes', async () => {
  const res = await fetch(`${baseUrl}/api/meal-plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entries: [
        { date: '2024-07-01', mealType: 'dinner', recipeId: 'missing-recipe', servings: 2 },
      ],
    }),
  });

  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(body.error, 'no_valid_entries');
  assert.strictEqual(body.invalidEntries.length, 1);
});

test('returns warnings when some meal plan entries reference unknown recipes', async () => {
  const res = await fetch(`${baseUrl}/api/meal-plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entries: [
        { date: '2024-07-02', mealType: 'lunch', recipeId: 'recipe-italian-pasta', servings: 2 },
        { date: '2024-07-02', mealType: 'dinner', recipeId: 'unknown', servings: 3 },
      ],
    }),
  });

  assert.strictEqual(res.status, 201);
  const plan = await res.json();
  assert.strictEqual(plan.entries.length, 1);
  assert.ok(Array.isArray(plan.invalidEntries));
  assert.strictEqual(plan.invalidEntries.length, 1);
});

test('builds a cart from a meal plan for a chosen store', async () => {
  const planRes = await fetch(`${baseUrl}/api/meal-plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startDate: '2024-05-01',
      entries: [
        { date: '2024-05-01', mealType: 'dinner', recipeId: 'recipe-italian-pasta', servings: 4 },
        { date: '2024-05-02', mealType: 'dinner', recipeId: 'recipe-chicken-tacos', servings: 4 },
      ],
    }),
  });
  const plan = await planRes.json();

  const cartRes = await fetch(`${baseUrl}/api/meal-plans/${plan.id}/cart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeId: 'store-100', zipcode: '94103' }),
  });

  assert.strictEqual(cartRes.status, 201);
  const payload = await cartRes.json();
  assert.ok(payload.cart?.id);
  assert.ok(Array.isArray(payload.cart.items));
  assert.ok(payload.cart.items.length > 0);
  assert.ok(Array.isArray(payload.unmatchedIngredients));
  assert.strictEqual(payload.unmatchedIngredients.length, 0);
});
