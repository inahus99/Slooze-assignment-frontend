"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE!;

type MenuItem = { id: number; name: string; price: number };
type Restaurant = { id: number; name: string; country: string; menuItems: MenuItem[] };
type OrderItem = { id: number; quantity: number; menuItem: MenuItem };
type Order = { id: number; status: "CREATED" | "PAID" | "CANCELLED"; totalCents: number; items: OrderItem[] };
type Me = { id: number; name: string; email: string; role: "ADMIN" | "MANAGER" | "MEMBER"; country: string; paymentMethod?: string | null };

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("password123");

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [cart, setCart] = useState<{ menuItemId: number; quantity: number }[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);

  // -------- helpers to load data with the current token --------
  async function loadMe(t: string) {
    const r = await fetch(API + "/me", { headers: { Authorization: "Bearer " + t } });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data?.email) throw new Error(data?.error || "me failed");
    setMe(data);
  }

  async function loadRestaurants(t: string) {
    const r = await fetch(API + "/restaurants", { headers: { Authorization: "Bearer " + t } });
    const data = await r.json().catch(() => null);
    if (!r.ok || !Array.isArray(data)) throw new Error(data?.error || "restaurants failed");
    setRestaurants(data);
  }

  async function loadMyOrders(t: string) {
    const r = await fetch(API + "/orders/my", { headers: { Authorization: "Bearer " + t } });
    const data = await r.json().catch(() => null);
    if (!r.ok || !Array.isArray(data)) throw new Error(data?.error || "orders failed");
    setMyOrders(data);
  }

  // on first mount, restore token from localStorage
  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) setToken(t);
  }, []);

  // whenever token changes, (re)load everything
  useEffect(() => {
    if (!token) return;
    Promise.all([loadMe(token), loadRestaurants(token), loadMyOrders(token)]).catch(err => {
      console.error("bootstrap load failed:", err);
      setMe(null);
      setRestaurants([]);
      setMyOrders([]);
    });
  }, [token]);

  // -------- auth actions --------
  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setMe(null);
    setCart([]);
    setRestaurants([]);
    setMyOrders([]);
  }

  async function login(e: any) {
    e.preventDefault();
    const r = await fetch(API + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const d = await r.json().catch(() => null);
    if (!d?.token) return alert("Login failed");
    localStorage.setItem("token", d.token);
    setToken(d.token);
    // load immediately so UI updates without waiting for effects
    await Promise.all([loadMe(d.token), loadRestaurants(d.token), loadMyOrders(d.token)]);
  }

  // -------- cart / order actions --------
  function addToCart(menuItemId: number) {
    setCart(prev => {
      const ex = prev.find(i => i.menuItemId === menuItemId);
      if (ex) return prev.map(i => (i.menuItemId === menuItemId ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { menuItemId, quantity: 1 }];
    });
  }

  async function createOrder() {
    if (!cart.length || !token) return;
    const r = await fetch(API + "/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ items: cart })
    });
    const d = await r.json();
    if (!r.ok) return alert(JSON.stringify(d));
    setCart([]);
    await loadMyOrders(token);
  }

  async function checkout(id: number) {
    if (!token) return;
    const r = await fetch(API + `/orders/${id}/checkout`, { method: "POST", headers: { Authorization: "Bearer " + token } });
    const d = await r.json();
    if (!r.ok) return alert(JSON.stringify(d));
    await loadMyOrders(token);
  }

  async function cancelOrder(id: number) {
    if (!token) return;
    const r = await fetch(API + `/orders/${id}/cancel`, { method: "POST", headers: { Authorization: "Bearer " + token } });
    const d = await r.json();
    if (!r.ok) return alert(JSON.stringify(d));
    await loadMyOrders(token);
  }

  async function deleteOrder(id: number) {
    if (!token) return;
    const r = await fetch(API + `/orders/${id}`, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
    const d = await r.json();
    if (!r.ok) return alert(JSON.stringify(d));
    await loadMyOrders(token);
  }

  async function updatePayment() {
    if (!token) return;
    const pm = prompt("Enter new payment method (Admin only):");
    if (!pm) return;
    const r = await fetch(API + "/me/payment-method", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ paymentMethod: pm })
    });
    const d = await r.json();
    if (!r.ok) return alert(JSON.stringify(d));
    await loadMe(token);
  }

  // -------- UI --------
  if (!token) {
    return (
      <div className="card">
        <h2>Login</h2>
        <p>Use e.g. <code>nick@slooze.xyz</code> / <code>password123</code></p>
        <form onSubmit={login}>
          <input placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
          <input placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <b>Logged in as:</b>{" "}
        {me ? (<>{me.name} ({me.role}) — {me.country}</>) : "Loading…"}
        <button onClick={logout} style={{ marginLeft: 8 }}>Logout</button>
        {me?.role === "ADMIN" && <button onClick={updatePayment} style={{ marginLeft: 8 }}>Update Payment Method</button>}
        {!!me?.paymentMethod && <span style={{ marginLeft: 8, opacity: 0.8 }}>Payment: {me.paymentMethod}</span>}
      </div>

      <div className="card">
        <h2>Restaurants (scoped)</h2>
        <div>
          {Array.isArray(restaurants) && restaurants.length ? (
            restaurants.map(r => (
              <div key={r.id} style={{ marginBottom: 12 }}>
                <b>{r.name}</b> — {r.country}
                <ul>
                  {r.menuItems.map(m => (
                    <li key={m.id}>
                      {m.name} — ₹{(m.price / 100).toFixed(2)}{" "}
                      <button onClick={() => addToCart(m.id)}>Add</button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <div style={{ opacity: .8 }}>No restaurants to show.</div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Cart</h2>
        {cart.length === 0 && <div>Cart is empty</div>}
        {cart.map(c => (<div key={c.menuItemId}>Item {c.menuItemId} × {c.quantity}</div>))}
        <button disabled={!cart.length} onClick={createOrder}>Create Order</button>
      </div>

      <div className="card">
        <h2>My Orders</h2>
        {myOrders.map(o => {
          const canAct = (me?.role === "ADMIN" || me?.role === "MANAGER") && o.status === "CREATED";
          return (
            <div key={o.id} style={{ border: "1px solid #444", padding: 8, margin: "6px 0" }}>
              <div>Order #{o.id} — {o.status} — total ₹{(o.totalCents / 100).toFixed(2)}</div>
              <ul>
                {o.items.map(it => (<li key={it.id}>{it.menuItem.name} × {it.quantity}</li>))}
              </ul>
              {canAct && (
                <>
                  <button onClick={() => checkout(o.id)}>Checkout & Pay</button>
                  <button onClick={() => cancelOrder(o.id)} style={{ marginLeft: 8 }}>Cancel</button>
                </>
              )}
              {me?.role === "ADMIN" && (
                <button onClick={() => deleteOrder(o.id)} style={{ marginLeft: 8 }}>Delete</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
