# UI wireframes and flows

This document captures low-fidelity wireframes and interaction notes for the RecipeApp iOS client. Each section outlines the key UI regions, supporting data, and offline behaviors needed for a resilient grocery planning experience.

## Weekly planner (calendar-style list of meals)
```
Week of May 12–18           [Store: Kroger #1234]
-------------------------------------------------
Mon  ✓ Breakfast  Greek yogurt bowl (4 servings)
     ▢ Lunch      Leftovers
     ▢ Dinner     Sheet-pan salmon + veggies

Tue  ▢ Breakfast  Overnight oats (prep tonight)
     ▢ Lunch      Tomato soup + grilled cheese
     ▢ Dinner     Pasta with roasted broccoli

[ + Add meal ]                     [ ⋯ Preferences ]
-------------------------------------------------
Footer: Offline draft saved · Last sync 2m ago · Refresh ↻
```
- **Interactions**: tap a slot to swap recipe, adjust servings, or mark cooked; long-press opens quick actions (duplicate, skip day). The header store badge jumps to store selector.
- **Data hooks**: planner binds to `MealPlan.entries` and pulls recipe cards with image + prep time. Refresh pulls updated price/availability snapshots for ingredients used in the week.
- **Offline**: edits queue locally with a “draft” pill; sync retries in background when connectivity resumes.

## Recipe picker & importer
```
[Search bar: "chicken, vegetarian"]   [Filter ▾]
-----------------------------------------------
Curated • Trending • Saved • Imported tabs

Card grid / list:
[ Hero image ]  Lemon Herb Chicken        (⭐️ 4.8)
10 ingredients · 35 min · Serves 4        [Add]

[ + Import from link ]  Paste URL or share from Safari
```
- **Interactions**: search + filters (diet tags, budget slider). Tapping **Add** opens serving selection then injects into selected day. Import flow shows parse progress and highlights fields requiring confirmation.
- **Data hooks**: uses backend parsing endpoints and caches last 20 searches for offline recall; imported recipes are stored in local Core Data until sync.

## Grocery list review
```
Store: Kroger #1234      ZIP 94103      [Change]
-------------------------------------------------
Grouped by aisle/category with availability

Produce
- Broccoli crowns (2)                In stock   $2.49 ea
- Lemon (3)                          Low stock  $0.79 ea
- ✓ Parsley bunch (1)                Subbed → Cilantro

Pantry
- Spaghetti 1lb box (2)              In stock   $1.99
- Olive oil 500ml (1)                Unavail → See subs

[Apply substitutions]  [Refresh prices]
Totals: $43.21 est · Last checked 5m ago
```
- **Interactions**: swipe to remove, tap to open substitution drawer, toggle recipe context chips (“from Pasta night”). Batch actions to apply suggested subs or re-run mapping with preference changes.
- **Data hooks**: binds to cart draft with SKU-level price/inventory; shows delta badges when background refresh detects changes.
- **Offline**: cart edits accumulate in draft; price refresh button is disabled with tooltip when offline.

## Cart confirmation & handoff
```
Cart ready for checkout — Kroger #1234
--------------------------------------
Items ready: 18      Changes since review: 2
Estimated total: $47.10 (taxes at checkout)

[Review changes]   [Continue to Kroger]

Notes: We’ll hold this cart for 1h. Checkout occurs in the retailer app/site.
```
- **Interactions**: “Review changes” shows a diff of price/availability shifts; primary CTA opens deep link/redirect URL. Secondary action allows saving cart without checkout.
- **Data hooks**: uses `POST /api/cart/:id/checkout` handoff URL; pulls latest inventory before enabling CTA.
- **Offline**: CTA disabled with banner “Need connection to finalize cart”; users can still save draft locally.

## Credentials & preferences
```
Account & Connections
-------------------------------------------------
OpenAI access
- [Enter API key]  ◻︎ Remember on device (Keychain)
- or [Sign in with provider] (if proxied OAuth)
Retailer
- Store selector: [Kroger #1234 ▾]  (Change ZIP)
Preferences
- Dietary tags:  [Vegan] [Gluten-free] [Nut-free]
- Budget:        <$75 / week   [slider]
- Substitution rules: prefer store brand; avoid peanut oils
```
- **Interactions**: choosing store pivots all price/availability lookups; dietary tags and budget feed prompt context and substitution scoring.
- **Security**: API key stored in iOS Keychain; OAuth tokens exchanged and stored server-side per README guidance.

## Offline draft state & background refresh
- **Draft mode**: planner edits, recipe imports, and cart changes are persisted locally with a “draft” badge until synced. Conflicts resolve by showing a merge sheet (local vs. server values) per field.
- **Background refresh**: price and availability checks run periodically (e.g., background task every few hours) and on app foreground. Deltas annotate the grocery list and planner with “price changed” or “out of stock” chips, prompting re-review.
- **User control**: refresh interval and cellular-only toggle live in Preferences; manual refresh buttons are available on planner and grocery list surfaces.
