# Herbal Hub Frontend

A polished, fully working React storefront for **Herbal Hub**, a hyper-local
herbal-medicine e-commerce platform. It runs entirely on its own — no backend
server required — thanks to a built-in mock API layer.

## Getting Started

```bash
npm install
npm start        # dev server at http://localhost:3000
npm run build    # production build in ./build
```

## Demo Accounts

The app seeds sample data (products, orders, reviews, prescriptions) on first
load. Use these accounts (or click the shortcut buttons on the login page):

| Role     | Email                 | Password  |
| -------- | --------------------- | --------- |
| Admin    | `adsayashanmuganathan16@gmail.com` | `Adsaya#16` |
| Customer | `demo@herbalhub.in`   | `demo123` |
| Seller   | `seller@herbalhub.in` | `seller123` |

You can also register a new customer account from the Register page.

## What works

- **Storefront** — home, category browsing, search, filters & sorting, product
  detail pages with reviews and related products.
- **Cart & checkout** — add/update/remove items, delivery-charge logic, place
  orders, order history and live status tracking.
- **Account** — register / login / logout, editable profile, prescriptions
  upload, notifications.
- **Admin panel** — dashboard, manage medicines (CRUD), manage orders &
  statuses, manage users, and reports/analytics with CSV export.

## How it works (no backend needed)

Instead of calling a real HTTP backend, `src/api/axios.js` is a small
axios-compatible client that routes every request to an **in-browser mock
backend** (`src/mock/`):

- `src/mock/db.js` — seed data + a `localStorage`-backed data store.
- `src/mock/backend.js` — request router implementing all API endpoints.

Because it uses `localStorage`, your changes (new orders, cart, profile edits,
products you add as admin, etc.) persist across page reloads. To wipe the data
and re-seed, clear the site's `localStorage` (or bump `SEED_VERSION` in
`src/mock/db.js`).

To connect a real backend later, replace `src/api/axios.js` with a normal axios
instance pointed at your API — the rest of the app already speaks the same
endpoints.

## Project Structure

- `src/api/` — API client and per-domain call modules
- `src/mock/` — in-browser mock backend (seed data + router)
- `src/components/` — reusable UI components
- `src/pages/` — route-level pages (including `pages/admin`)
- `src/context/` — React context providers (auth, cart)
- `src/utils/` — helper functions
