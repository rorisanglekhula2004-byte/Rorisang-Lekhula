import { useEffect, useState } from "react";
import { api, setToken, hasToken } from "./api.js";

const money = (n) => `M${Number(n).toFixed(2)}`; // Maloti; change currency symbol if needed
const STATUSES = ["Pending", "Preparing", "Ready", "Collected"];

export default function App() {
  const [view, setView] = useState("menu");
  const [staff, setStaff] = useState(hasToken());
  const [cart, setCart] = useState({}); // { itemId: { item, quantity } }
  const count = Object.values(cart).reduce((s, l) => s + l.quantity, 0);

  return (
    <div className="app">
      <header>
        <h1>☕ Bean There Coffee</h1>
        <nav>
          <button className={view === "menu" ? "on" : ""} onClick={() => setView("menu")}>Menu</button>
          <button className={view === "cart" ? "on" : ""} onClick={() => setView("cart")}>Cart ({count})</button>
          <button className={view === "track" ? "on" : ""} onClick={() => setView("track")}>Track order</button>
          <button className={view === "staff" ? "on" : ""} onClick={() => setView("staff")}>Staff</button>
        </nav>
      </header>
      <main>
        {view === "menu" && <Menu cart={cart} setCart={setCart} />}
        {view === "cart" && <Cart cart={cart} setCart={setCart} />}
        {view === "track" && <Track />}
        {view === "staff" && (staff ? <Dashboard onLogout={() => { setToken(""); setStaff(false); }} /> : <Login onOk={() => setStaff(true)} />)}
      </main>
    </div>
  );
}

function useLoad(fn, deps = []) {
  const [state, set] = useState({ data: null, error: "", loading: true });
  const reload = () => {
    set((s) => ({ ...s, loading: true }));
    fn().then((data) => set({ data, error: "", loading: false })).catch((e) => set({ data: null, error: e.message, loading: false }));
  };
  useEffect(reload, deps);
  return { ...state, reload };
}

function Menu({ cart, setCart }) {
  const { data, error, loading } = useLoad(api.menu);
  const add = (item) => setCart((c) => ({ ...c, [item.id]: { item, quantity: (c[item.id]?.quantity || 0) + 1 } }));
  if (loading) return <p>Loading menu…</p>;
  if (error) return <p className="err">Could not load menu: {error}</p>;
  if (!data.length) return <p>The menu is empty right now.</p>;
  const cats = [...new Set(data.map((i) => i.category))];
  return cats.map((cat) => (
    <section key={cat}>
      <h2>{cat}</h2>
      <div className="grid">
        {data.filter((i) => i.category === cat).map((i) => (
          <div className={`card ${i.available ? "" : "off"}`} key={i.id}>
            <h3>{i.name}</h3>
            <p>{i.description}</p>
            <div className="row"><strong>{money(i.price)}</strong><span>{i.available ? "Available" : "Sold out"}</span></div>
            <button disabled={!i.available} onClick={() => add(i)}>Add to cart</button>
          </div>
        ))}
      </div>
    </section>
  ));
}

function Cart({ cart, setCart }) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState(null);
  const lines = Object.values(cart);
  const total = lines.reduce((s, l) => s + l.item.price * l.quantity, 0);
  const setQty = (id, q) => setCart((c) => { const n = { ...c }; q < 1 ? delete n[id] : (n[id] = { ...n[id], quantity: q }); return n; });

  const submit = async () => {
    setError(""); setBusy(true);
    try {
      setOrder(await api.placeOrder({ customerName: name, notes, items: lines.map((l) => ({ id: l.item.id, quantity: l.quantity })) }));
      setCart({});
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (order) return (
    <div className="card confirm">
      <h2>✅ Order confirmed</h2>
      <p>Thank you, {order.customerName}! Your order number is</p>
      <p className="big">{order.orderNumber}</p>
      <p>Total: {money(order.total)} · Status: {order.status}</p>
      <p>Use “Track order” with this number to check progress.</p>
    </div>
  );
  if (!lines.length) return <p>Your cart is empty. Add something from the menu.</p>;
  return (
    <div className="card">
      <h2>Your cart</h2>
      {lines.map(({ item, quantity }) => (
        <div className="row line" key={item.id}>
          <span>{item.name}</span>
          <span>
            <button onClick={() => setQty(item.id, quantity - 1)}>−</button> {quantity} <button onClick={() => setQty(item.id, quantity + 1)}>+</button>
          </span>
          <span>{money(item.price * quantity)}</span>
        </div>
      ))}
      <h3>Total: {money(total)}</h3>
      <input placeholder="Your name *" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Notes (e.g. oat milk, no sugar)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <p className="err">{error}</p>}
      <button disabled={busy || !name.trim()} onClick={submit}>{busy ? "Placing…" : "Place order"}</button>
    </div>
  );
}

function Track() {
  const [id, setId] = useState("");
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const find = async () => {
    setError(""); setOrder(null);
    try { setOrder(await api.getOrder(id.trim())); } catch (e) { setError(e.message); }
  };
  return (
    <div className="card">
      <h2>Track your order</h2>
      <input placeholder="Order number e.g. CS-0001" value={id} onChange={(e) => setId(e.target.value)} />
      <button onClick={find} disabled={!id.trim()}>Check status</button>
      {error && <p className="err">{error}</p>}
      {order && <p><strong>{order.orderNumber}</strong> for {order.customerName}: <span className={`badge ${order.status}`}>{order.status}</span></p>}
    </div>
  );
}

function Login({ onOk }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const go = async () => {
    try { const { token } = await api.login(pw); setToken(token); onOk(); } catch (e) { setError(e.message); }
  };
  return (
    <div className="card">
      <h2>Staff login</h2>
      <input type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} />
      <button onClick={go}>Log in</button>
      {error && <p className="err">{error}</p>}
    </div>
  );
}

const blank = { name: "", description: "", price: "", category: "Coffee", available: true };

function Dashboard({ onLogout }) {
  const menu = useLoad(api.menu);
  const orders = useLoad(api.orders);
  const summary = useLoad(api.summary);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const guard = async (fn) => {
    setError("");
    try { await fn(); } catch (e) { setError(e.message); if (/login/i.test(e.message)) onLogout(); }
  };
  const save = () => guard(async () => {
    const body = { ...form, price: parseFloat(form.price) };
    editing ? await api.updateItem(editing, body) : await api.addItem(body);
    setForm(blank); setEditing(null); menu.reload();
  });
  const remove = (id) => confirm("Delete this item?") && guard(async () => { await api.deleteItem(id); menu.reload(); });
  const toggle = (i) => guard(async () => { await api.updateItem(i.id, { available: !i.available }); menu.reload(); });
  const status = (id, s) => guard(async () => { await api.setStatus(id, s); orders.reload(); summary.reload(); });

  return (
    <>
      <div className="row"><h2>Staff dashboard</h2><button onClick={onLogout}>Log out</button></div>
      {error && <p className="err">{error}</p>}

      <section className="card">
        <h3>Daily summary</h3>
        {summary.data?.length ? summary.data.map((d) => <p key={d.date}>{d.date}: {d.orders} orders · {money(d.revenue)}</p>) : <p>No orders yet.</p>}
      </section>

      <section className="card">
        <h3>{editing ? "Edit menu item" : "Add menu item"}</h3>
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input placeholder="Price" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {["Coffee", "Tea", "Pastries", "Other"].map((c) => <option key={c}>{c}</option>)}
        </select>
        <label><input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} /> Available</label>
        <button onClick={save}>{editing ? "Save changes" : "Add item"}</button>
        {editing && <button onClick={() => { setEditing(null); setForm(blank); }}>Cancel</button>}
      </section>

      <section className="card">
        <h3>Menu items</h3>
        {menu.data?.map((i) => (
          <div className="row line" key={i.id}>
            <span>{i.name} · {money(i.price)} · {i.category}</span>
            <span>
              <button onClick={() => toggle(i)}>{i.available ? "Mark sold out" : "Mark available"}</button>
              <button onClick={() => { setEditing(i.id); setForm({ ...i }); }}>Edit</button>
              <button onClick={() => remove(i.id)}>Delete</button>
            </span>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="row"><h3>Orders</h3><button onClick={() => { orders.reload(); summary.reload(); }}>Refresh</button></div>
        {orders.data?.length ? orders.data.map((o) => (
          <div className="order" key={o.id}>
            <div className="row"><strong>{o.orderNumber} · {o.customerName}</strong><span className={`badge ${o.status}`}>{o.status}</span></div>
            <small>{new Date(o.createdAt).toLocaleString()} · {money(o.total)}</small>
            <p>{o.items.map((l) => `${l.quantity}× ${l.name}`).join(", ")}{o.notes && ` — “${o.notes}”`}</p>
            {STATUSES.map((s) => <button key={s} disabled={s === o.status} onClick={() => status(o.id, s)}>{s}</button>)}
          </div>
        )) : <p>No orders yet.</p>}
      </section>
    </>
  );
}
