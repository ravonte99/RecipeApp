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

test('searches products by zipcode and keyword', async () => {
  const res = await fetch(`${baseUrl}/api/products/search?zipcode=94103&query=milk`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.ok(body.products.length > 0);
  assert.ok(body.products.every((p) => p.name.toLowerCase().includes('milk')));
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
