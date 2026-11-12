import "dotenv/config";
import express from "express";
import cors from "cors";
import Redis from "ioredis";
import crypto from "crypto";

const app = express();
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
const STATUSES = ["Pending", "Preparing", "Ready", "Collected"];
const SECRET = process.env.TOKEN_SECRET || "dev-secret";

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

// ---------- helpers ----------
const fail = (res, code, message) => res.status(code).json({ error: message });
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const getJSON = async (key) => { const v = await redis.get(key); return v ? JSON.parse(v) : null; };
const getMany = async (setKey, prefix) => {
  const ids = await redis.smembers(setKey);
  if (!ids.length) return [];
  const vals = await redis.mget(ids.map((i) => `${prefix}:${i}`));
  return vals.filter(Boolean).map((v) => JSON.parse(v));
};

// stateless signed token (HMAC) for staff
const sign = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
};
const verify = (token = "") => {
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  return JSON.parse(Buffer.from(body, "base64url").toString()).exp > Date.now();
};
const requireStaff = (req, res, next) =>
  verify((req.headers.authorization || "").replace("Bearer ", "")) ? next() : fail(res, 401, "Staff login required");

const validateMenu = (b, partial = false) => {
  const errs = [];
  if (!partial || b.name !== undefined) if (typeof b.name !== "string" || !b.name.trim()) errs.push("name is required");
  if (!partial || b.price !== undefined) if (typeof b.price !== "number" || b.price < 0) errs.push("price must be a non-negative number");
  if (b.available !== undefined && typeof b.available !== "boolean") errs.push("available must be boolean");
  return errs;
};

// ---------- health & auth ----------
app.get("/api/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.post("/api/auth/login", (req, res) => {
  if (req.body?.password !== (process.env.STAFF_PASSWORD || "change-me")) return fail(res, 401, "Wrong password");
  res.json({ token: sign({ role: "staff", exp: Date.now() + 8 * 3600 * 1000 }) });
});

// ---------- menu ----------
app.get("/api/menu", wrap(async (_req, res) => {
  res.json((await getMany("menu:ids", "menu")).sort((a, b) => a.name.localeCompare(b.name)));
}));

app.get("/api/menu/:id", wrap(async (req, res) => {
  const item = await getJSON(`menu:${req.params.id}`);
  item ? res.json(item) : fail(res, 404, "Menu item not found");
}));

app.post("/api/menu", requireStaff, wrap(async (req, res) => {
  const errs = validateMenu(req.body);
  if (errs.length) return fail(res, 400, errs.join(", "));
  const { name, description = "", price, category = "Coffee", available = true } = req.body;
  const item = { id: crypto.randomUUID(), name: name.trim(), description, price, category, available };
  await redis.multi().set(`menu:${item.id}`, JSON.stringify(item)).sadd("menu:ids", item.id).exec();
  res.status(201).json(item);
}));

app.put("/api/menu/:id", requireStaff, wrap(async (req, res) => {
  const existing = await getJSON(`menu:${req.params.id}`);
  if (!existing) return fail(res, 404, "Menu item not found");
  const errs = validateMenu(req.body, true);
  if (errs.length) return fail(res, 400, errs.join(", "));
  const { name, description, price, category, available } = req.body;
  const updated = { ...existing, ...Object.fromEntries(Object.entries({ name, description, price, category, available }).filter(([, v]) => v !== undefined)) };
  await redis.set(`menu:${existing.id}`, JSON.stringify(updated));
  res.json(updated);
}));

app.delete("/api/menu/:id", requireStaff, wrap(async (req, res) => {
  const removed = await redis.del(`menu:${req.params.id}`);
  if (!removed) return fail(res, 404, "Menu item not found");
  await redis.srem("menu:ids", req.params.id);
  res.status(204).end();
}));

// ---------- orders ----------
app.post("/api/orders", wrap(async (req, res) => {
  const { customerName, notes = "", items } = req.body || {};
  if (typeof customerName !== "string" || !customerName.trim()) return fail(res, 400, "customerName is required");
  if (!Array.isArray(items) || !items.length) return fail(res, 400, "items must be a non-empty array");
  const lines = [];
  for (const { id, quantity } of items) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) return fail(res, 400, "quantity must be an integer 1-50");
    const menuItem = await getJSON(`menu:${id}`);
    if (!menuItem) return fail(res, 400, `Menu item ${id} does not exist`);
    if (!menuItem.available) return fail(res, 400, `${menuItem.name} is currently unavailable`);
    lines.push({ id, name: menuItem.name, price: menuItem.price, quantity }); // price snapshot
  }
  const seq = await redis.incr("orders:seq");
  const order = {
    id: crypto.randomUUID(),
    orderNumber: `CS-${String(seq).padStart(4, "0")}`,
    customerName: customerName.trim(), notes, items: lines,
    total: Math.round(lines.reduce((s, l) => s + l.price * l.quantity, 0) * 100) / 100,
    status: "Pending", createdAt: new Date().toISOString(),
  };
  await redis.multi().set(`order:${order.id}`, JSON.stringify(order)).sadd("orders:ids", order.id).exec();
  res.status(201).json(order);
}));

app.get("/api/orders", requireStaff, wrap(async (_req, res) => {
  res.json((await getMany("orders:ids", "order")).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}));

// must be declared before /:id
app.get("/api/orders/summary/daily", requireStaff, wrap(async (_req, res) => {
  const orders = await getMany("orders:ids", "order");
  const days = {};
  for (const o of orders) {
    const d = o.createdAt.slice(0, 10);
    days[d] ??= { date: d, orders: 0, revenue: 0 };
    days[d].orders += 1; days[d].revenue += o.total;
  }
  res.json(Object.values(days).sort((a, b) => b.date.localeCompare(a.date)));
}));

// accepts internal id or the order number shown on the confirmation
app.get("/api/orders/:id", wrap(async (req, res) => {
  let order = await getJSON(`order:${req.params.id}`);
  if (!order) order = (await getMany("orders:ids", "order")).find((o) => o.orderNumber === req.params.id.toUpperCase());
  order ? res.json(order) : fail(res, 404, "Order not found");
}));

app.patch("/api/orders/:id/status", requireStaff, wrap(async (req, res) => {
  const order = await getJSON(`order:${req.params.id}`);
  if (!order) return fail(res, 404, "Order not found");
  if (!STATUSES.includes(req.body?.status)) return fail(res, 400, `status must be one of: ${STATUSES.join(", ")}`);
  order.status = req.body.status;
  await redis.set(`order:${order.id}`, JSON.stringify(order));
  res.json(order);
}));

// ---------- errors ----------
app.use((req, res) => fail(res, 404, `Route ${req.method} ${req.path} not found`));
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.type === "entity.parse.failed") return fail(res, 400, "Invalid JSON body");
  fail(res, 500, "Internal server error");
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API listening on ${port}`));
