const assistantPrompts = {
  ingredientParsing: {
    name: 'ingredient_parsing',
    goal: 'Convert unstructured recipe text into normalized ingredient requirements.',
    systemPrompt: [
      'You are a culinary parser that extracts ingredients with quantities and normalized units.',
      'Work step-by-step in a hidden <scratchpad> section to resolve ambiguous fractions, pluralization, and unit aliases.',
      'Do not expose the <scratchpad>; only return the final JSON payload.',
      'Prefer metric units where possible and preserve preparation notes (e.g., chopped, minced).',
      'Output MUST follow the JSON schema exactly—no prose, no comments.',
    ].join(' '),
    outputSchema: {
      type: 'object',
      required: ['ingredients'],
      properties: {
        ingredients: {
          type: 'array',
          items: {
            type: 'object',
            required: ['original_text', 'ingredient_name', 'quantity', 'unit'],
            properties: {
              original_text: { type: 'string', description: 'Raw line from the recipe.' },
              ingredient_name: { type: 'string', description: 'Normalized pantry-friendly name.' },
              quantity: { type: 'number', description: 'Decimal quantity after fraction resolution.' },
              unit: { type: 'string', description: 'Normalized unit; prefer metric or countable pieces.' },
              preparation_note: { type: 'string', description: 'Chopped, minced, room temperature, etc.', default: '' },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
    deterministicResponse: {
      temperature: 0,
      top_p: 0,
      presence_penalty: 0,
      frequency_penalty: 0,
      max_output_tokens: 700,
    },
  },
  unitNormalization: {
    name: 'unit_normalization',
    goal: 'Normalize mixed cooking units to grams, milliliters, or pieces with rationale.',
    systemPrompt: [
      'You are a unit conversion specialist for recipes.',
      'Use a private <scratchpad> for chain-of-thought calculations and density lookups; never include it in the response.',
      'Favor grams for solids and milliliters for liquids. Keep conversions reversible and avoid rounding beyond two decimals.',
      'If density is missing or confidence is low, retain the original unit and explain in the rationale.',
      'Return ONLY JSON matching the schema and nothing else.',
    ].join(' '),
    outputSchema: {
      type: 'object',
      required: ['normalized_quantity', 'normalized_unit', 'rationale'],
      properties: {
        normalized_quantity: { type: 'number', description: 'Quantity after conversion.' },
        normalized_unit: { type: 'string', description: 'grams | milliliters | pieces | original' },
        rationale: { type: 'string', description: 'Short reasoning for the chosen unit/quantity.' },
      },
      additionalProperties: false,
    },
    deterministicResponse: {
      temperature: 0,
      top_p: 0,
      presence_penalty: 0,
      frequency_penalty: 0,
      max_output_tokens: 220,
    },
  },
};

const guardrailPolicies = {
  tokenLimits: {
    requestMaxTokens: 2800,
    responseMaxTokens: 900,
    enforcedVia: 'max_output_tokens with streaming disabled to avoid overruns',
  },
  retryPolicy: {
    maxAttempts: 3,
    initialBackoffMs: 500,
    backoffMultiplier: 2,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  },
  contentFiltering: {
    enforcedCategories: ['hate', 'self-harm', 'sexual', 'violence'],
    rejectionMessage: 'Unable to process this request due to content safety policies.',
    strategy: 'Pre-call and post-call moderation with blocking + redaction of unsafe snippets.',
  },
  costMonitoring: {
    maxRequestUsd: 0.05,
    maxDailyUsd: 12,
    alertThresholds: [0.5, 0.8, 0.95],
    logging: 'Log token usage per request; aggregate hourly and emit alerts when thresholds exceeded.',
  },
};

module.exports = { assistantPrompts, guardrailPolicies };
