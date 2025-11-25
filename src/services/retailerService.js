const { randomUUID } = require('crypto');
const { stores, catalog } = require('../data/retailerData');

class RetailerService {
  constructor() {
    this.stores = stores;
    this.catalog = catalog;
    this.carts = new Map();
  }

  getAssistantCapabilities() {
    return {
      automaticShopping: false,
      description:
        'The prototype can search products, stage carts, and build checkout links, but a human must confirm and submit orders.',
      requiresUserReview: true,
      supportedFlows: ['store_lookup', 'product_search', 'cart_building', 'checkout_handoff'],
      unsupportedFlows: ['auto_purchase', 'payment_processing'],
    };
  }

  findStoresByZip(zipcode) {
    if (!zipcode) return [];
    return this.stores.filter((store) => store.zipcode === zipcode);
  }

  getStore(storeId) {
    return this.stores.find((store) => store.id === storeId);
  }

  searchProducts({ query, storeId, zipcode }) {
    const storesForLookup = storeId
      ? [this.getStore(storeId)].filter(Boolean)
      : this.findStoresByZip(zipcode);

    const results = [];
    storesForLookup.forEach((store) => {
      const items = this.catalog[store.id] || [];
      items.forEach((item) => {
        if (
          !query ||
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          item.brand.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
        ) {
          results.push({ ...item, storeId: store.id });
        }
      });
    });

    return results;
  }

  findProduct(storeId, sku) {
    const inventory = this.catalog[storeId] || [];
    return inventory.find((item) => item.sku === sku);
  }

  validateItems(storeId, items = []) {
    const validated = [];
    const fallbacks = [];

    items.forEach((item) => {
      const product = this.findProduct(storeId, item.sku);
      if (!product) {
        fallbacks.push({
          skuRequested: item.sku,
          reason: 'sku_not_found',
          alternatives: this.generateAlternatives({ storeId, category: item.category }),
          allowManualEdit: true,
        });
        return;
      }

      if (!product.inStock) {
        fallbacks.push({
          skuRequested: item.sku,
          reason: 'out_of_stock',
          alternatives: this.generateAlternatives({ storeId, category: product.category, excludeSku: product.sku }),
          allowManualEdit: true,
        });
        return;
      }

      validated.push({
        sku: product.sku,
        name: product.name,
        quantity: item.quantity || 1,
        unit: item.unit || 'ea',
        price: product.price,
        currency: product.currency,
        storeId,
      });
    });

    return { items: validated, fallbacks };
  }

  generateAlternatives({ storeId, category, excludeSku }) {
    const inventory = this.catalog[storeId] || [];
    return inventory
      .filter((item) => item.inStock && item.category === category && item.sku !== excludeSku)
      .slice(0, 3)
      .map((item) => ({
        sku: item.sku,
        name: item.name,
        price: item.price,
        currency: item.currency,
        size: item.size,
      }));
  }

  buildCartTotals(items) {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return { subtotal: Number(subtotal.toFixed(2)), currency: items[0]?.currency || 'USD' };
  }

  createCart({ storeId, zipcode, items }) {
    const store = this.getStore(storeId);
    if (!store) {
      return { error: 'store_not_found' };
    }

    const { items: validatedItems, fallbacks } = this.validateItems(storeId, items);
    const cartId = randomUUID();
    const totals = this.buildCartTotals(validatedItems);

    const cart = {
      id: cartId,
      storeId,
      zipcode: zipcode || store.zipcode,
      items: validatedItems,
      fallbacks,
      totals,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };

    this.carts.set(cartId, cart);
    return cart;
  }

  getCart(cartId) {
    return this.carts.get(cartId);
  }

  addItems(cartId, items) {
    const cart = this.getCart(cartId);
    if (!cart) {
      return { error: 'cart_not_found' };
    }

    const { items: validatedItems, fallbacks } = this.validateItems(cart.storeId, items);
    cart.items.push(...validatedItems);
    cart.fallbacks.push(...fallbacks);
    cart.totals = this.buildCartTotals(cart.items);
    cart.updatedAt = new Date().toISOString();
    return cart;
  }

  buildCheckoutUrls(cart) {
    const store = this.getStore(cart.storeId);
    const base = store?.handoffDomain || 'https://www.example.com';
    const query = new URLSearchParams({ cartId: cart.id, storeId: cart.storeId }).toString();
    return {
      webUrl: `${base}/checkout?${query}`,
      deepLink: `retailer://checkout?${query}`,
    };
  }
}

module.exports = { RetailerService };
