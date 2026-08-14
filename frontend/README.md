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

## Deploying to Vercel

Import the repository into Vercel and set the project **Root Directory** to
`frontend`. The committed `vercel.json` configures the Create React App build
and preserves client-side routing when a page is opened directly.

Add the following variables in **Project Settings > Environment Variables**
for Production and Preview, then redeploy:

```env
REACT_APP_API_URL=https://your-backend.example.com
REACT_APP_GEOAPIFY_API_KEY=your_geoapify_api_key
REACT_APP_GOOGLE_CLIENT_ID=your_google_web_client_id.apps.googleusercontent.com
```

`REACT_APP_API_URL` must be the public HTTPS origin of the deployed FastAPI
backend, without a trailing slash. On the backend, set `FRONTEND_URL` and add
the Vercel production domain to `ALLOWED_ORIGINS` so browser API requests,
email links, and WebSocket connections use the deployed frontend.

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
