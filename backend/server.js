const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_emergent');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/api/socket.io"
});

app.use(express.json());

// Verilənlər bazası simulyasiyası
const db = {
    users: {
        "customer@test.com": { id: "c1", name: "Müştəri Əli", role: "customer", password: "password123" },
        "pizza@example.com": { id: "r1", name: "Mehmet Bəyin Restoranı", role: "restaurant", password: "password123", x: 3, y: 3 },
        "courier@test.com": { id: "k1", name: "Kuryer Fatih", role: "courier", password: "password123", x: 5, y: 5, status: "available" }
    },
    orders: {}
};

// --- API-LƏR ---

// 1. Giriş API-si
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.users[email];
    if (user && user.password === password) {
        return res.json({ token: `mock-jwt-${user.id}`, user });
    }
    return res.status(400).json({ detail: "Səhv email və ya şifrə!" });
});

// 2. Sifariş Yaratma və Stripe Ödəniş API-si
app.post('/api/orders', async (req, res) => {
    const { customer_id, customer_name } = req.body;
    const order_id = `ORD-${Date.now().toString().slice(-4)}`;

    try {
        const session = await stripe.checkout.Sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: { name: 'Ersağ Göz Sifarişi' },
                    unit_amount: 2000, // 20.00 USD
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: 'https://dashboard.stripe.com/test/payments',
            cancel_url: req.headers.origin,
        });

        const newOrder = {
            id: order_id,
            customer_id,
            customer_name,
            restaurant_id: "r1",
            status: "pending",
            stripe_url: session.url
        };

        db.orders[order_id] = newOrder;
        io.to("restaurant_room").emit("new_order", newOrder);
        return res.json(newOrder);

    } catch (err) {
        return res.status(500).json({ detail: err.message });
    }
});

// 3. Mehmet Bəyin Düyməsi - Status Yeniləmə API-si
app.post('/api/orders/:order_id/status', (req, res) => {
    const { order_id } = req.params;
    const { status } = req.body;
    const order = db.orders[order_id];

    if (!order) return res.status(404).json({ detail: "Sifariş tapılmadı" });

    order.status = status;
    io.to(order_id).emit("order_updated", order);

    // Əgər restoran HAZIR düyməsinə basdısa, ən yaxın kuryeri tap
    if (status === "ready") {
        const restoran = db.users["pizza@example.com"];
        let enYakinKuryer = null;
        let enQisaMesafe = Infinity;

        Object.values(db.users).forEach(u => {
            if (u.role === "courier" && u.status === "available") {
                let mesafe = Math.sqrt(Math.pow(restoran.x - u.x, 2) + Math.pow(restoran.y - u.y, 2));
                if (mesafe < enQisaMesafe) {
                    enQisaMesafe = mesafe;
                    enYakinKuryer = u;
                }
            }
        });

        if (enYakinKuryer) {
            io.to(`courier_${enYakinKuryer.id}`).emit("courier_request", order);
        }
    }

    return res.json(order);
});

// --- REAL-VAXT BAĞLANTILARI (SOCKET.IO) ---
io.on('connection', (socket) => {
    socket.on('join_room', (data) => {
        if (data.role === 'restaurant') socket.join("restaurant_room");
        if (data.role === 'courier') socket.join(`courier_${data.user_id}`);
        if (data.order_id) socket.join(data.order_id);
    });

    socket.on('update_location', (data) => {
        io.to(data.order_id).emit("live_location", data.coords);
    });
});

// --- VİZUAL EKRAN (FRONTEND İNTEQRASİYASI) ---
// Bu hissə brauzerdə birbaşa tətbiqi görməyinizi təmin edir
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Kuryer Sistemi</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <script src="/api/socket.io/socket.io.js"></script>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
            body { font-family: sans-serif; padding: 20px; background: #f4f4f9; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-bottom: 15px; }
            button { background: #007bff; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; }
            #map { height: 250px; width: 100%; border-radius: 8px; margin-top: 10px; }
        </style>
    </head>
    <body>
        <div id="root"></div>
        <script type="text/babel">
            const socket = io({ path: "/api/socket.io" });
            function App() {
                const [user, setUser] = React.useState(null);
                const [email, setEmail] = React.useState('');
                const [password, setPassword] = React.useState('');
                const [orders, setOrders] = React.useState([]);
                const [activeOrder, setActiveOrder] = React.useState(null);
                const mapRef = React.useRef(null);
                const markerRef = React.useRef(null);

                React.useEffect(() => {
                    socket.on("new_order", (o) => { setOrders(p => [...p, o]); alert("🔔 Mehmet Bəy, yeni sifariş var!"); });
                    socket.on("courier_request", (o) => { setActiveOrder(o); alert("🚀 Yeni kuryer sifarişi hazır!"); });
                    socket.on("order_updated", (o) => setActiveOrder(o));
                    socket.on("live_location", (c) => { if(markerRef.current) markerRef.current.setLatLng([c.lat, c.lng]); });
                }, []);

                const handleLogin = async (e) => {
                    e.preventDefault();
                    const res = await fetch("/api/auth/login", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email, password })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        setUser(data.user);
                        socket.emit("join_room", { role: data.user.role, user_id: data.user.id });
                    } else alert(data.detail);
                };

                if (!user) {
                    return (
                        <div style={{textAlign:'center', marginTop:'50px'}} className="card">
                            <h2>Sistemə Giriş</h2>
                            <form onSubmit={handleLogin}>
                                <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} /><br/><br/>
                                <input type="password" placeholder="Şifrə" value={password} onChange={e=>setPassword(e.target.value)} /><br/><br/>
                                <button type="submit">Giriş</button>
                            </form>
                        </div>
                    );
                }

                return (
                    <div>
                        <h2>Xoş gəldiniz, {user.name} ({user.role.toUpperCase()})</h2>
                        {user.role === 'customer' && (
                            <div className="card">
                                <button onClick={async () => {
                                    const res = await fetch("/api/orders", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ customer_id: user.id, customer_name: user.name })
                                    });
                                    const data = await res.json();
                                    window.location.href = data.stripe_url;
                                }}>Ersağ Göz Sifarişi Ver (20 USD)</button>
                                {activeOrder && (
                                    <div>
                                        <h4>Status: <span style={{color:'green'}}>{activeOrder.status}</span></h4>
                                        <div id="map"></div>
                                    </div>
                                )}
                            </div>
                        )}
                        {user.role === 'restaurant' && (
                            <div className="card">
                                <h3>Mehmet Bəyin Paneli</h3>
                                {orders.map(o => (
                                    <div key={o.id}>
                                        <p>Sifariş: {o.id} - Status: {o.status}</p>
                                        <button onClick={() => fetch(\`/api/orders/\${o.id}/status\`, {
                                            method: "POST",
                                            headers: {"Content-Type": "application/json"},
                                            body: JSON.stringify({ status: "ready" })
                                        })}>HAZIR düyməsi</button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {user.role === 'courier' && (
                            <div className="card">
                                {activeOrder ? (
                                    <button onClick={() => {
                                        let lat = 40.4093;
                                        setInterval(() => {
                                            lat += 0.001;
                                            socket.emit("update_location", { order_id: activeOrder.id, coords: { lat, lng: 49.8671 } });
                                        }, 3000);
                                    }}>Sifarişi Qəbul Et və Məkanı Paylaş</button>
                                ) : <p>Sifariş gözlənilir...</p>}
                            </div>
                        )}
                    </div>
                );
            }
            ReactDOM.createRoot(document.getElementById('root')).render(<App />);
        </script>
    </body>
    </html>
    `);
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server ${PORT} portunda aktivdir.`));
