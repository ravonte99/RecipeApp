const http = require('http');
const { URL } = require('url');
const { RetailerService } = require('./services/retailerService');
const { MealPlanService } = require('./services/mealPlanService');
const { ShoppingService } = require('./services/shoppingService');

function parseBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        resolve({});
      }
    });
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function createRequestHandler(retailerService, mealPlanService, shoppingService) {
  const retailerSvc = retailerService || new RetailerService();
  const mealPlanSvc = mealPlanService || new MealPlanService();
  const shoppingSvc = shoppingService || new ShoppingService(mealPlanSvc, retailerSvc);

  return async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const { pathname, searchParams } = url;

    // CORS and preflight support
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    if (pathname === '/api/assistant/capabilities' && req.method === 'GET') {
      const capabilities = retailerSvc.getAssistantCapabilities();
      sendJson(res, 200, capabilities);
      return;
    }

    if (pathname === '/api/assistant/prompts' && req.method === 'GET') {
      const prompts = retailerSvc.getAssistantPrompts();
      sendJson(res, 200, prompts);
      return;
    }

    if (pathname === '/api/assistant/guardrails' && req.method === 'GET') {
      const guardrails = retailerSvc.getAssistantGuardrails();
      sendJson(res, 200, guardrails);
      return;
    }

    if (pathname === '/api/stores' && req.method === 'GET') {
      const zipcode = searchParams.get('zipcode') || '';
      const matches = retailerSvc.findStoresByZip(zipcode);
      sendJson(res, 200, { zipcode, stores: matches });
      return;
    }

    if (pathname === '/api/products/search' && req.method === 'GET') {
      const query = searchParams.get('query') || '';
      const zipcode = searchParams.get('zipcode') || '';
      const storeId = searchParams.get('storeId') || '';
      const products = retailerSvc.searchProducts({ query, storeId, zipcode });
      sendJson(res, 200, { query, zipcode, storeId, products });
      return;
    }

    if (pathname === '/api/cart' && req.method === 'POST') {
      const body = await parseBody(req);
      const cart = retailerSvc.createCart({
        storeId: body.storeId,
        zipcode: body.zipcode,
        items: body.items || [],
      });

      if (cart.error === 'store_not_found') {
        sendJson(res, 404, { error: 'store_not_found', message: 'Store not found for cart creation.' });
        return;
      }

      sendJson(res, 201, cart);
      return;
    }

    if (pathname.startsWith('/api/cart/') && req.method === 'GET') {
      const cartId = pathname.split('/').pop();
      const cart = retailerSvc.getCart(cartId);
      if (!cart) {
        sendJson(res, 404, { error: 'cart_not_found' });
        return;
      }
      sendJson(res, 200, cart);
      return;
    }

    if (pathname.startsWith('/api/cart/') && req.method === 'POST') {
      const parts = pathname.split('/').filter(Boolean);
      const cartId = parts[2];
      const action = parts[3];
      const body = await parseBody(req);

      if (action === 'items') {
        const cart = retailerSvc.addItems(cartId, body.items || []);
        if (cart.error) {
          sendJson(res, 404, cart);
          return;
        }
        sendJson(res, 200, cart);
        return;
      }

      if (action === 'checkout') {
        const cart = retailerSvc.getCart(cartId);
        if (!cart) {
          sendJson(res, 404, { error: 'cart_not_found' });
          return;
        }
        const urls = retailerSvc.buildCheckoutUrls(cart);
        sendJson(res, 200, { cartId, ...urls });
        return;
      }
    }

    if (pathname === '/api/recipes' && req.method === 'GET') {
      sendJson(res, 200, { recipes: mealPlanSvc.listRecipes() });
      return;
    }

    if (pathname.startsWith('/api/recipes/') && req.method === 'GET') {
      const recipeId = pathname.split('/').pop();
      const recipe = mealPlanSvc.getRecipe(recipeId);
      if (!recipe) {
        sendJson(res, 404, { error: 'recipe_not_found' });
        return;
      }
      sendJson(res, 200, recipe);
      return;
    }

    if (pathname === '/api/meal-plans' && req.method === 'GET') {
      sendJson(res, 200, { mealPlans: mealPlanSvc.listMealPlans() });
      return;
    }

    if (pathname === '/api/meal-plans' && req.method === 'POST') {
      const body = await parseBody(req);
      const plan = mealPlanSvc.createMealPlan({ startDate: body.startDate, entries: body.entries || [] });
      sendJson(res, 201, plan);
      return;
    }

    if (pathname.startsWith('/api/meal-plans/') && req.method === 'GET') {
      const parts = pathname.split('/').filter(Boolean);
      const planId = parts[2];
      const action = parts[3];

      const plan = mealPlanSvc.getMealPlan(planId);
      if (!plan) {
        sendJson(res, 404, { error: 'meal_plan_not_found' });
        return;
      }

      if (action === 'grocery-list') {
        const groceryList = mealPlanSvc.buildGroceryList(planId);
        sendJson(res, 200, groceryList);
        return;
      }

      sendJson(res, 200, plan);
      return;
    }

    if (pathname.startsWith('/api/meal-plans/') && req.method === 'POST') {
      const parts = pathname.split('/').filter(Boolean);
      const planId = parts[2];
      const action = parts[3];

      if (action === 'cart') {
        const body = await parseBody(req);
        const payload = shoppingSvc.buildCartFromMealPlan({
          planId,
          storeId: body.storeId,
          zipcode: body.zipcode,
        });

        if (payload.error === 'meal_plan_not_found') {
          sendJson(res, 404, { error: 'meal_plan_not_found' });
          return;
        }

        if (payload.cart?.error === 'store_not_found') {
          sendJson(res, 404, { error: 'store_not_found' });
          return;
        }

        sendJson(res, 201, payload);
        return;
      }
    }

    sendJson(res, 404, { error: 'not_found' });
  };
}

function startServer(port = process.env.PORT || 3000) {
  const retailerService = new RetailerService();
  const mealPlanService = new MealPlanService();
  const shoppingService = new ShoppingService(mealPlanService, retailerService);
  const server = http.createServer(createRequestHandler(retailerService, mealPlanService, shoppingService));
  server.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { createRequestHandler, startServer, RetailerService, MealPlanService, ShoppingService };
