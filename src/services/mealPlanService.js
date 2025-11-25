const { randomUUID } = require('crypto');
const recipes = require('../data/recipes');

function scaleIngredients(ingredients, factor) {
  const aggregated = new Map();

  ingredients.forEach((item) => {
    const key = `${item.ingredient}|${item.unit}`;
    const current = aggregated.get(key) || { ...item, quantity: 0 };
    current.quantity = Number((current.quantity + item.quantity * factor).toFixed(2));
    aggregated.set(key, current);
  });

  return Array.from(aggregated.values());
}

class MealPlanService {
  constructor() {
    this.recipes = recipes;
    this.mealPlans = new Map();
  }

  listRecipes() {
    return this.recipes.map(({ id, title, description, servings, prepTimeMinutes, cookTimeMinutes, tags }) => ({
      id,
      title,
      description,
      servings,
      prepTimeMinutes,
      cookTimeMinutes,
      tags,
    }));
  }

  getRecipe(id) {
    return this.recipes.find((recipe) => recipe.id === id);
  }

  createMealPlan({ startDate, entries = [] }) {
    const planId = randomUUID();
    const normalizedEntries = entries.map((entry) => ({
      ...entry,
      id: randomUUID(),
      servings: entry.servings || this.getRecipe(entry.recipeId)?.servings || 2,
    }));

    const plan = {
      id: planId,
      startDate: startDate || new Date().toISOString().slice(0, 10),
      endDate: '',
      entries: normalizedEntries,
      createdAt: new Date().toISOString(),
    };

    this.mealPlans.set(planId, plan);
    return plan;
  }

  getMealPlan(id) {
    return this.mealPlans.get(id);
  }

  buildGroceryList(planId) {
    const plan = this.getMealPlan(planId);
    if (!plan) return { error: 'meal_plan_not_found' };

    const combinedIngredients = [];

    plan.entries.forEach((entry) => {
      const recipe = this.getRecipe(entry.recipeId);
      if (!recipe) return;
      const factor = entry.servings / recipe.servings;
      combinedIngredients.push(...scaleIngredients(recipe.ingredients, factor));
    });

    const aggregated = scaleIngredients(combinedIngredients, 1);
    return { planId, ingredients: aggregated };
  }
}

module.exports = { MealPlanService };
