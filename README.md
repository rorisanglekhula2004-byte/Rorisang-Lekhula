# Coffee Shop Management System

Full-stack web app (BIWA2110 Group Assignment): customers browse the menu, build a cart and place orders; staff manage the menu and process orders.

**Live links (fill in before submitting)**
- Frontend: https://YOUR-APP.vercel.app
- Backend API: https://YOUR-API.onrender.com (check `/api/health`)
- Repository: https://github.com/YOUR-TEAM/coffee-shop

## Technologies
| Layer | Tech | Hosting |
|---|---|---|
| Frontend | React 18 + Vite, Fetch API | Vercel / Netlify |
| Backend | Node.js + Express.js REST API | Render (Web Service) |
| Database | Redis (key-value NoSQL, persistence on) | Render Key Value / Upstash |

## Data model (keys → JSON values)
- `menu:<uuid>` → `{id, name, description, price, category, available}`; `menu:ids` is a set of all menu ids
- `order:<uuid>` → `{id, orderNumber, customerName, notes, items[], total, status, createdAt}`; `orders:ids` is a set of order ids
- `orders:seq` → counter used to make order numbers (CS-0001, CS-0002, …)

## Run locally
Requirements: Node 18+, a Redis instance (`docker run -p 6379:6379 redis`).

```bash
# backend
cd backend && cp .env.example .env && npm install && npm run dev
# frontend (new terminal)
cd frontend && cp .env.example .env && npm install && npm run dev
```
Open http://localhost:5173. Staff password is `STAFF_PASSWORD` in `backend/.env`.

## API endpoints
Staff routes need `Authorization: Bearer <token>` from `POST /api/auth/login` (`{"password": "..."}`).

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | /api/health | public | Backend availability |
| POST | /api/auth/login | public | Get staff token |
| GET | /api/menu | public | All menu items |
| GET | /api/menu/:id | public | One menu item |
| POST | /api/menu | staff | Add item (201) |
| PUT | /api/menu/:id | staff | Update item |
| DELETE | /api/menu/:id | staff | Delete item (204) |
| POST | /api/orders | public | Place order (prices calculated server-side) |
| GET | /api/orders | staff | All orders |
| GET | /api/orders/:id | public | One order (by id or order number) |
| PATCH | /api/orders/:id/status | staff | Pending / Preparing / Ready / Collected |
| GET | /api/orders/summary/daily | staff | Orders and revenue per day |

Errors return `{ "error": "message" }` with 400 (validation), 401 (auth), 404 (not found) or 500.

## Deployment
1. **Database:** create a Redis instance with persistence (Render Key Value, or Upstash). Copy its connection URL.
2. **Backend (Render):** New Web Service → connect repo → root directory `backend`, build `npm install`, start `npm start`. Environment variables: `REDIS_URL`, `STAFF_PASSWORD`, `TOKEN_SECRET`, `FRONTEND_URL` (your frontend URL). Verify `/api/health`.
3. **Frontend (Vercel/Netlify):** import repo → root directory `frontend`, build `npm run build`, output `dist`. Environment variable: `VITE_API_URL` = your Render URL. Redeploy after setting it.

## Testing checklist
- `GET /api/health` returns `{"status":"ok"}`
- Staff logs in, adds a menu item, it appears on the customer menu
- Customer adds items, places order, receives order number
- Staff changes status Pending → Preparing → Ready → Collected; Track order page reflects it
- Restart the backend: menu and orders are still there (persistence)
- Invalid input (empty name, negative price, bad status) returns 400; staff routes without token return 401

## Team contributions
| Member | Student ID | Contribution |
|---|---|---|
| | | |
