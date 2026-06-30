import express from "express";
import cors from "cors";
import { RESTAURANTS, COURIERS, CUSTOMER_POS } from "./data.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

let orders = [];
let orderSeq = 1004;
let settings = { restaurant: 78, courier: 17, platform: 5 };

const STATUS = {
  PENDING: "pending",
  PREPARING: "preparing",
  READY: "ready",
  PICKED_UP: "picked_up",
  DELIVERING: "delivering",
  DELIVERED: "delivered",
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

setInterval(() => {
  orders = orders.map((o) => {
    if (o.status !== STATUS.PICKED_UP && o.status !== STATUS.DELIVERING) return o;
    const rest = RESTAURANTS.find((r) => r.id === o.restaurantId);
    let t = (o.progress ?? 0) + 0.06;
    let status = o.status === STATUS.PICKED_UP ? STATUS.DELIVERING : o.status;
    if (t >= 1) {
      t = 1;
      status = STATUS.DELIVERED;
    }
    return {
      ...o,
      progress: t,
      status,
      courierPos: { x: lerp(rest.pos.x, CUSTOMER_POS.x, t), y: lerp(rest.pos.y, CUSTOMER_POS.y, t) },
    };
  });
}, 700);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/restaurants", (req, res) => res.json(RESTAURANTS));
app.get("/api/couriers", (req, res) => res.json(COURIERS));
app.get("/api/meta", (req, res) => res.json({ customerPos: CUSTOMER_POS }));

app.get("/api/settings", (req, res) => res.json(settings));
app.patch("/api/settings", (req, res) => {
  const { restaurant, courier, platform } = req.body;
  settings = {
    restaurant: Number(restaurant ?? settings.restaurant),
    courier: Number(courier ?? settings.courier),
    platform: Number(platform ?? settings.platform),
  };
  res.json(settings);
});

app.get("/api/orders", (req, res) => {
  const { restaurantId, courierId, customerName } = req.query;
  let list = orders;
  if (restaurantId) list = list.filter((o) => o.restaurantId === restaurantId);
  if (courierId) list = list.filter((o) => o.courierId === courierId);
  if (customerName) list = list.filter((o) => o.customerName === customerName);
  res.json(list.slice().sort((a, b) => b.createdAt - a.createdAt));
});

app.post("/api/orders", (req, res) => {
  const { customerName, restaurantId, items } = req.body;
  if (!customerName || !restaurantId || !items?.length) {
    return res.status(400).json({ error: "customerName, restaurantId, items mütləqdir" });
  }
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const order = {
    id: orderSeq++,
    customerName,
    restaurantId,
    items,
    total,
    status: STATUS.PENDING,
    courierId: null,
    courierPos: null,
    progress: 0,
    createdAt: Date.now(),
  };
  orders.unshift(order);
  res.status(201).json(order);
});

app.patch("/api/orders/:id", (req, res) => {
  const id = Number(req.params.id);
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return res.status(404).json({ error: "Sifariş tapılmadı" });
  orders[idx] = { ...orders[idx], ...req.body };
  res.json(orders[idx]);
});

app.listen(PORT, () => console.log(`Backend ${PORT} portunda işləyir`));
