// All backend calls use the Fetch API. Base URL comes from an environment variable.
const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
let token = sessionStorage.getItem("staffToken") || "";

export const setToken = (t) => { token = t; t ? sessionStorage.setItem("staffToken", t) : sessionStorage.removeItem("staffToken"); };
export const hasToken = () => !!token;

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (password) => request("/api/auth/login", { method: "POST", body: { password } }),
  menu: () => request("/api/menu"),
  addItem: (item) => request("/api/menu", { method: "POST", body: item }),
  updateItem: (id, item) => request(`/api/menu/${id}`, { method: "PUT", body: item }),
  deleteItem: (id) => request(`/api/menu/${id}`, { method: "DELETE" }),
  placeOrder: (order) => request("/api/orders", { method: "POST", body: order }),
  getOrder: (id) => request(`/api/orders/${encodeURIComponent(id)}`),
  orders: () => request("/api/orders"),
  setStatus: (id, status) => request(`/api/orders/${id}/status`, { method: "PATCH", body: { status } }),
  summary: () => request("/api/orders/summary/daily"),
};
