const express = require("express");
const http    = require("http");
const { Server } = require("socket.io");
const path    = require("path");
const db      = require("./db");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const DELIVERY_FEE = 2.0;

function fullOrder(id) {
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!o) return null;
  o.items = db.prepare(`
    SELECT oi.qty, p.name, p.price, p.unit
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
  `).all(id);
  o.market  = db.prepare("SELECT name FROM markets  WHERE id = ?").get(o.market_id);
  if (o.courier_id)
    o.courier = db.prepare("SELECT name FROM couriers WHERE id = ?").get(o.courier_id);
  return o;
}

app.get("/api/markets", (req, res) => {
  res.json(db.prepare("SELECT * FROM markets").all());
});

app.get("/api/markets/:id/products", (req, res) => {
  res.json(db.prepare("SELECT * FROM products WHERE market_id = ? ORDER BY category").all(req.params.id));
});

app.get("/api/couriers", (req, res) => {
  res.json(db.prepare("SELECT * FROM couriers").all());
});

app.get("/api/couriers/:id", (req, res) => {
  const k = db.prepare("SELECT * FROM couriers WHERE id = ?").get(req.params.id);
  if (!k) return res.status(404).json({ error: "Tapılmadı" });
  res.json(k);
});

app.get("/api/orders", (req, res) => {
  const { status, market_id, courier_id } = req.query;
  let sql = "SELECT id FROM orders WHERE 1=1";
  const params = [];
  if (status)     { sql += " AND status = ?";     params.push(status); }
  if (market_id)  { sql += " AND market_id = ?";  params.push(market_id); }
  if (courier_id) { sql += " AND courier_id = ?"; params.push(courier_id); }
  sql += " ORDER BY id DESC";
  res.json(db.prepare(sql).all(...params).map(r => fullOrder(r.id)));
});

app.get("/api/orders/:id", (req, res) => {
  const o = fullOrder(req.params.id);
  if (!o) return res.status(404).json({ error: "Tapılmadı" });
  res.json(o);
});

app.post("/api/orders", (req, res) => {
  const { market_id, items, customerLat, customerLng, customerAddr } = req.body;
  if (!items || items.length === 0)
    return res.status(400).json({ error: "Səbət boşdur" });

  const products = db.prepare("SELECT * FROM products WHERE market_id = ?").all(market_id);
  let subtotal = 0;
  for (const it of items) {
    const p = products.find(x => x.id === it.id);
    if (!p) return res.status(400).json({ error: `Məhsul tapılmadı: ${it.id}` });
    subtotal += p.price * it.qty;
  }
  const total = +(subtotal + DELIVERY_FEE).toFixed(2);

  const { lastInsertRowid: oid } = db.prepare(`
    INSERT INTO orders (market_id,status,total,delivery_fee,customer_lat,customer_lng,customer_addr)
    VALUES (?,'yeni',?,?,?,?,?)
  `).run(market_id, total, DELIVERY_FEE, customerLat, customerLng, customerAddr || "");

  const addOI = db.prepare("INSERT INTO order_items (order_id,product_id,qty) VALUES (?,?,?)");
  items.forEach(it => addOI.run(oid, it.id, it.qty));

  const o = fullOrder(oid);
  io.to(`market_${market_id}`).emit("yeni_sifaris", o);
  res.json(o);
});

app.post("/api/orders/:id/ready", (req, res) => {
  db.prepare("UPDATE orders SET status='hazir' WHERE id=?").run(req.params.id);
  const o = fullOrder(req.params.id);
  io.to("kuryerler").emit("sifaris_hazir", o);
  res.json(o);
});

app.post("/api/orders/:id/accept", (req, res) => {
  const { courierId } = req.body;
  const k = db.prepare("SELECT * FROM couriers WHERE id=?").get(courierId);
  if (!k) return res.status(404).json({ error: "Kuryer tapılmadı" });
  db.prepare(`UPDATE orders SET status='yolda',courier_id=?,courier_lat=?,courier_lng=? WHERE id=?`)
    .run(courierId, k.lat, k.lng, req.params.id);
  db.prepare("UPDATE couriers SET busy=1 WHERE id=?").run(courierId);
  const o = fullOrder(req.params.id);
  io.to(`sifaris_${o.id}`).emit("kuryer_qebul_etdi", o);
  io.to("kuryerler").emit("sifaris_goturuldu", { id: o.id });
  res.json(o);
});

app.post("/api/orders/:id/location", (req, res) => {
  const { lat, lng, courierId } = req.body;
  db.prepare("UPDATE orders SET courier_lat=?,courier_lng=? WHERE id=?").run(lat, lng, req.params.id);
  if (courierId)
    db.prepare("UPDATE couriers SET lat=?,lng=? WHERE id=?").run(lat, lng, courierId);
  io.to(`sifaris_${req.params.id}`).emit("kuryer_mekan", { lat, lng });
  res.json({ ok: true });
});

app.post("/api/orders/:id/deliver", (req, res) => {
  const row = db.prepare("SELECT * FROM orders WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Tapılmadı" });
  db.prepare("UPDATE orders SET status='catdirildi' WHERE id=?").run(req.params.id);
  if (row.courier_id)
    db.prepare("UPDATE couriers SET balance=balance+?,busy=0 WHERE id=?").run(row.delivery_fee, row.courier_id);
  const o = fullOrder(req.params.id);
  const k = row.courier_id ? db.prepare("SELECT * FROM couriers WHERE id=?").get(row.courier_id) : null;
  io.to(`sifaris_${o.id}`).emit("sifaris_catdirildi", o);
  if (k) io.to(`kuryer_${k.id}`).emit("balans_yenilendi", k);
  res.json({ order: o, kuryer: k });
});

io.on("connection", socket => {
  socket.on("qosul_market",    mid => socket.join(`market_${mid}`));
  socket.on("qosul_kuryerler", ()  => socket.join("kuryerler"));
  socket.on("qosul_sifaris",   oid => socket.join(`sifaris_${oid}`));
  socket.on("qosul_kuryer",    kid => socket.join(`kuryer_${kid}`));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🛒 Bazar Yol: http://localhost:${PORT}`));
