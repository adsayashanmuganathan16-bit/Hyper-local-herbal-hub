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

## Accounts

The frontend does not contain seeded credentials. Customers can register from
the Register page, while administrator provisioning is configured securely in
the backend environment.

## What works

- **Storefront** — home, category browsing, search, filters & sorting, product
  detail pages with reviews and related products.
- **Cart & checkout** — add/update/remove items, delivery-charge logic, place
  orders, order history and live status tracking.
- **Account** — register / login / logout, editable profile, prescriptions
  upload, notifications.
- **Admin panel** — dashboard, manage medicines (CRUD), manage orders &
  statuses, manage users, and reports/analytics with CSV export.

## How it works

The frontend uses Axios to communicate with the FastAPI backend configured by
`REACT_APP_API_URL`. Authentication, checkout, payments, and role permissions
are enforced by the backend.

## Project Structure

- `src/api/` — API client and per-domain call modules
- `src/components/` — reusable UI components
- `src/pages/` — route-level pages (including `pages/admin`)
- `src/context/` — React context providers (auth, cart)
- `src/utils/` — helper functions
