const ingredientSearchMap = {
  spaghetti: 'spaghetti pasta',
  'cherry tomatoes': 'cherry tomatoes',
  'fresh basil': 'basil',
  garlic: 'garlic',
  'olive oil': 'olive oil',
  salt: 'sea salt',
  'black pepper': 'black pepper',
  'boneless chicken thighs': 'chicken thighs',
  'corn tortillas': 'corn tortillas',
  lime: 'limes',
  'orange juice': 'orange juice',
  'red cabbage': 'red cabbage',
  cilantro: 'cilantro',
  carrots: 'carrots',
  'snow peas': 'snow peas',
  'bell pepper': 'bell pepper',
  ginger: 'ginger',
  'soy sauce': 'soy sauce',
  'sesame oil': 'sesame oil',
  'rice vinegar': 'rice vinegar',
  'broccoli florets': 'broccoli',
};

class ShoppingService {
  constructor(mealPlanService, retailerService) {
    this.mealPlanService = mealPlanService;
    this.retailerService = retailerService;
  }

  mapIngredientToProduct({ ingredient, storeId, zipcode }) {
    const query = ingredientSearchMap[ingredient.ingredient] || ingredient.ingredient;
    const products = this.retailerService.searchProducts({ query, storeId, zipcode });
    const inStock = products.find((product) => product.inStock);
    return inStock || products[0];
  }

  buildCartFromMealPlan({ planId, storeId, zipcode }) {
    const groceryList = this.mealPlanService.buildGroceryList(planId);
    if (groceryList.error) {
      return { error: groceryList.error };
    }

    const items = [];
    const unmatchedIngredients = [];

    groceryList.ingredients.forEach((ingredient) => {
      const product = this.mapIngredientToProduct({ ingredient, storeId, zipcode });
      if (!product) {
        unmatchedIngredients.push(ingredient);
        return;
      }

      items.push({
        sku: product.sku,
        quantity: Math.max(1, Math.ceil(ingredient.quantity / (product.packageSize || 1))),
        unit: 'ea',
      });
    });

    const cart = this.retailerService.createCart({ storeId, zipcode, items });
    return { planId, storeId, zipcode: cart.zipcode, cart, unmatchedIngredients };
  }
}

module.exports = { ShoppingService };
