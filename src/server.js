const http = require('http');
const { URL } = require('url');
const { RetailerService } = require('./services/retailerService');

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

function createRequestHandler(service = new RetailerService()) {
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
      const capabilities = service.getAssistantCapabilities();
      sendJson(res, 200, capabilities);
      return;
    }

    if (pathname === '/api/assistant/prompts' && req.method === 'GET') {
      const prompts = service.getAssistantPrompts();
      sendJson(res, 200, prompts);
      return;
    }

    if (pathname === '/api/assistant/guardrails' && req.method === 'GET') {
      const guardrails = service.getAssistantGuardrails();
      sendJson(res, 200, guardrails);
      return;
    }

    if (pathname === '/api/stores' && req.method === 'GET') {
      const zipcode = searchParams.get('zipcode') || '';
      const matches = service.findStoresByZip(zipcode);
      sendJson(res, 200, { zipcode, stores: matches });
      return;
    }

    if (pathname === '/api/products/search' && req.method === 'GET') {
      const query = searchParams.get('query') || '';
      const zipcode = searchParams.get('zipcode') || '';
      const storeId = searchParams.get('storeId') || '';
      const products = service.searchProducts({ query, storeId, zipcode });
      sendJson(res, 200, { query, zipcode, storeId, products });
      return;
    }

    if (pathname === '/api/cart' && req.method === 'POST') {
      const body = await parseBody(req);
      const cart = service.createCart({
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
      const cart = service.getCart(cartId);
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
        const cart = service.addItems(cartId, body.items || []);
        if (cart.error) {
          sendJson(res, 404, cart);
          return;
        }
        sendJson(res, 200, cart);
        return;
      }

      if (action === 'checkout') {
        const cart = service.getCart(cartId);
        if (!cart) {
          sendJson(res, 404, { error: 'cart_not_found' });
          return;
        }
        const urls = service.buildCheckoutUrls(cart);
        sendJson(res, 200, { cartId, ...urls });
        return;
      }
    }

    sendJson(res, 404, { error: 'not_found' });
  };
}

function startServer(port = process.env.PORT || 3000) {
  const service = new RetailerService();
  const server = http.createServer(createRequestHandler(service));
  server.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { createRequestHandler, startServer, RetailerService };
