"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE!;

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("password123");

  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [cart, setCart] = useState<{menuItemId:number, quantity:number}[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);

  useEffect(()=>{
    const t = localStorage.getItem("token");
    if (t) setToken(t);
  },[]);

  useEffect(()=>{
    if (!token) return;
    fetch(API + "/me", { headers: { Authorization: "Bearer " + token } })
      .then(r=>r.json()).then(setMe);
    fetch(API + "/restaurants", { headers: { Authorization: "Bearer " + token } })
      .then(r=>r.json()).then(setRestaurants);
    fetch(API + "/orders/my", { headers: { Authorization: "Bearer " + token } })
      .then(r=>r.json()).then(setMyOrders);
  }, [token]);

  function login(e:any){
    e.preventDefault();
    fetch(API + "/auth/login", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ email, password })
    }).then(r=>r.json()).then(d=>{
      if (d.token) {
        localStorage.setItem("token", d.token);
        setToken(d.token);
      } else {
        alert("Login failed");
      }
    });
  }

  function logout(){
    localStorage.removeItem("token");
    setToken(null);
    setMe(null);
  }

  function addToCart(menuItemId:number){
    setCart(prev=>{
      const existing = prev.find(i=>i.menuItemId===menuItemId);
      if (existing) return prev.map(i=> i.menuItemId===menuItemId? {...i, quantity:i.quantity+1}:i);
      return [...prev, { menuItemId, quantity: 1 }];
    });
  }

  function createOrder(){
    if (!cart.length) return alert("Cart empty");
    fetch(API + "/orders", {
      method: "POST",
      headers: {"Content-Type":"application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ items: cart })
    }).then(r=>r.json()).then(o=>{
      if (o.id) {
        alert("Order created #" + o.id);
        setCart([]);
        // refresh
        fetch(API + "/orders/my", { headers: { Authorization: "Bearer " + token } })
          .then(r=>r.json()).then(setMyOrders);
      } else {
        alert("Failed: " + JSON.stringify(o));
      }
    });
  }

  function checkout(id:number){
    fetch(API + "/orders/" + id + "/checkout", {
      method: "POST",
      headers: { Authorization: "Bearer " + token }
    }).then(r=>r.json()).then(d=>{
      if (d.status) {
        fetch(API + "/orders/my", { headers: { Authorization: "Bearer " + token } })
          .then(r=>r.json()).then(setMyOrders);
      } else alert(JSON.stringify(d));
    });
  }

  function cancelOrder(id:number){
    fetch(API + "/orders/" + id + "/cancel", {
      method: "POST",
      headers: { Authorization: "Bearer " + token }
    }).then(r=>r.json()).then(d=>{
      if (d.status) {
        fetch(API + "/orders/my", { headers: { Authorization: "Bearer " + token } })
          .then(r=>r.json()).then(setMyOrders);
      } else alert(JSON.stringify(d));
    });
  }

  function updatePayment(){
    const pm = prompt("Enter new payment method (Admin only):");
    if (!pm) return;
    fetch(API + "/me/payment-method", {
      method: "PATCH",
      headers: { "Content-Type":"application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ paymentMethod: pm })
    }).then(r=>r.json()).then(d=>{
      if (d.paymentMethod) {
        alert("Updated.");
        fetch(API + "/me", { headers: { Authorization: "Bearer " + token } })
          .then(r=>r.json()).then(setMe);
      } else alert(JSON.stringify(d));
    });
  }

  if (!token) {
    return (
      <div className="card">
        <h2>Login</h2>
        <p>Use any seeded user e.g. <code>nick@slooze.xyz</code>, password <code>password123</code></p>
        <form onSubmit={login}>
          <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
          <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          <button type="submit">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <b>Logged in as:</b> {me?.name} ({me?.role}) — {me?.country}{" "}
        <button onClick={logout}>Logout</button>
        {me?.role === "ADMIN" && <button onClick={updatePayment}>Update Payment Method</button>}
        {!!me?.paymentMethod && <span style={{marginLeft:8, opacity:0.8}}>Payment: {me.paymentMethod}</span>}
      </div>

      <div className="card">
        <h2>Restaurants (scoped)</h2>
        <div>
          {restaurants.map(r=>(
            <div key={r.id} style={{marginBottom:12}}>
              <b>{r.name}</b> — {r.country}
              <ul>
                {r.menuItems.map((m:any)=>(
                  <li key={m.id}>
                    {m.name} — ₹{(m.price/100).toFixed(2)}{" "}
                    <button onClick={()=>addToCart(m.id)}>Add</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Cart</h2>
        {cart.length === 0 && <div>Cart is empty</div>}
        {cart.map(c=>(<div key={c.menuItemId}>Item {c.menuItemId} × {c.quantity}</div>))}
        <button disabled={!cart.length} onClick={createOrder}>Create Order</button>
      </div>

      <div className="card">
        <h2>My Orders</h2>
        {myOrders.map(o=>(
          <div key={o.id} style={{border:"1px solid #444", padding:8, margin:"6px 0"}}>
            <div>Order #{o.id} — {o.status} — total ₹{(o.totalCents/100).toFixed(2)}</div>
            <ul>
              {o.items.map((it:any)=>(<li key={it.id}>{it.menuItem.name} × {it.quantity}</li>))}
            </ul>
            {(me?.role === "ADMIN" || me?.role === "MANAGER") && o.status==="CREATED" && (
              <>
                <button onClick={()=>checkout(o.id)}>Checkout & Pay</button>
                <button onClick={()=>cancelOrder(o.id)}>Cancel</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
