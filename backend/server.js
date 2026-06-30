const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Müvəqqəti Data Saxlanğıcı (Yaddaşda tutulur)
let orders = [];
let restaurants = [
    { 
        id: 1, 
        name: "Dadlı Restoran (Mərkəz)", 
        img: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=60",
        tags: "Pizza • Burger • Dönər",
        time: "15-25 dəq",
        menu: [
            { id: 101, name: "Dönər Çörəkdə", price: 4.5 }, 
            { id: 102, name: "Miks Pizza", price: 12.0 }
        ] 
    }
];

// Kuryerin başlanğıc koordinatı (Şəmkir/Gəncə ətrafı simulyasiya üçün)
let courierLocation = { lat: 40.8282, lng: 46.0128 }; 

// PROQRAMIN VİZUAL İNTERFEYSİ (MÜŞTƏRİ, MƏTBƏX VƏ KURYER BİRLİKDƏ)
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="az">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Catd-r Logistika Platforması</title>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        <style>
            :root { --primary: #ff4757; --bg: #f8f9fa; --dark: #2f3542; }
            body { font-family: '-apple-system', BlinkMacSystemFont, sans-serif; background-color: var(--bg); margin: 0; padding: 0; color: var(--dark); }
            
            /* Üst Menyu Rol Seçimi */
            .role-selector { background: #2f3542; padding: 10px; display: flex; justify-content: center; gap: 10px; }
            .role-btn { background: #747d8c; color: white; border: none; padding: 8px 15px; border-radius: 20px; font-weight: bold; cursor: pointer; font-size: 12px; }
            .role-btn.active { background: var(--primary); }

            .container { max-width: 450px; margin: 0 auto; padding: 15px; box-sizing: border-box; }
            .card { background: white; padding: 20px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 15px; border: 1px solid #eee; }
            
            /* Ümumi Elementlər */
            .btn { width: 100%; padding: 14px; border-radius: 10px; border: none; font-weight: bold; font-size: 15px; cursor: pointer; margin-top: 10px; }
            .btn-primary { background: var(--primary); color: white; }
            .btn-success { background: #2ed573; color: white; }
            
            /* Xəritə Simulyasiya Qutusu */
            .map-box { background: #eccc68; height: 180px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; overflow: hidden; margin-top: 15px; font-weight: bold; color: #57606f; }
            .marker { position: absolute; font-size: 24px; color: var(--primary); animation: bounce 1s infinite alternate; }
            @keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-5px); } }

            /* Gizli Panellər */
            .panel { display: none; }
            .panel.active { display: block; }
            
            .item-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; }
            .status-badge { background: #ffa502; color: white; padding: 5px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; }
        </style>
    </head>
    <body>

        <div class="role-selector">
            <button class="role-btn active" onclick="switchPanel('customer')">🙋‍♂️ Sifarişçi</button>
            <button class="role-btn" onclick="switchPanel('kitchen')">🍳 Mətbəx</button>
            <button class="role-btn" onclick="switchPanel('courier')">🏍️ Kuryer</button>
        </div>

        <div class="container">

            <div id="customerPanel" class="panel active">
                <div class="card">
                    <h2>Müasir Sifariş Paneli</h2>
                    <p style="color:#747d8c; font-size:14px;">Restoran: <b>Dadlı Restoran</b></p>
                    <div class="item-row">
                        <div>
                            <p style="margin:0; font-weight:bold;">Miks Pizza</p>
                            <span style="color:var(--primary); font-weight:bold;">12.00 AZN</span>
                        </div>
                        <button class="role-btn active" onclick="placeOrder()">Sifariş Ver</button>
                    </div>
                </div>

                <div class="card" id="customerTracking" style="display:none;">
                    <h3>📦 Sifarişin Durumu</h3>
                    <div class="item-row">
                        <span>Status:</span>
                        <span id="customerStatusBadge" class="status-badge">Gözlənilir</span>
                    </div>
                    
                    <div class="map-box">
                        <i class="fas fa-motorcycle marker" id="customerMapMarker" style="display:none;"></i>
                        <span id="mapPlaceholder">Kuryer təyin olunanda xəritə aktivləşəcək</span>
                    </div>
                    <button class="btn btn-primary" onclick="refreshCustomerSide()" style="background:#1e90ff;">🔄 Yenilə</button>
                </div>
            </div>


            <div id="kitchenPanel" class="panel">
                <div class="card">
                    <h2>🍳 Mətbəx Monitoru</h2>
                    <p style="color:#747d8c; font-size:13px;">Bura yeni sifarişlər anlıq bildiriş kimi düşür.</p>
                    <div id="kitchenOrdersContainer">
                        <p style="color:#a4b0be; text-align:center;">Hələ ki, yeni sifariş yoxdur.</p>
                    </div>
                </div>
            </div>


            <div id="courierPanel" class="panel">
                <div class="card">
                    <h2>🏍️ Kuryer Ekranı</h2>
                    <p style="color:#747d8c; font-size:13px;">Sənə ən yaxın olan hazır sifarişlər:</p>
                    <div id="courierOrdersContainer">
                        <p style="color:#a4b0be; text-align:center;">Hazır sifariş gözlənilir...</p>
                    </div>
                </div>
                
                <div class="card" id="courierMapCard" style="display:none;">
                    <h3>🗺️ Müştərinin Ünvanına Naviqasiya</h3>
                    <div class="map-box" style="background:#2ed573; color:white;">
                        <i class="fas fa-user-pin" style="font-size:30px;"></i>
                        <p style="margin:5px 0 0 0; font-size:14px;">Müştəri Ünvanına Doğru Hərəkət Edilir...</p>
                    </div>
                    <button class="btn btn-success" onclick="completeDelivery()">✅ Çatdırılmanı Tamamla</button>
                </div>
            </div>

        </div>

        <script>
            let currentOrderId = null;

            function switchPanel(panelName) {
                document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
                document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
                
                document.getElementById(panelName + 'Panel').classList.add('active');
                event.target.classList.add('active');

                if(panelName === 'kitchen') loadKitchenOrders();
                if(panelName === 'courier') loadCourierOrders();
            }

            // [MÜŞTƏRİ] Sifariş Verilməsi
            async function placeOrder() {
                const response = await fetch('/api/order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: ["Miks Pizza"], location: "Şəmkir, Mərkəz" })
                });
                const data = await response.json();
                currentOrderId = data.order.id;
                
                alert('Sifarişiniz Mətbəxə Göndərildi!');
                document.getElementById('customerTracking').style.display = 'block';
                document.getElementById('customerStatusBadge').innerText = data.order.status;
            }

            // [MÜŞTƏRİ] Status Yeniləmə və Xəritə İzləmə
            async function refreshCustomerSide() {
                if(!currentOrderId) return;
                const response = await fetch('/api/order/' + currentOrderId);
                const data = await response.json();
                
                document.getElementById('customerStatusBadge').innerText = data.status;
                
                if(data.status === "KURYERDƏ (Yoldadır)") {
                    document.getElementById('mapPlaceholder').innerText = "Kuryer Raul saniyələr içində çatır...";
                    document.getElementById('customerMapMarker').style.display = 'block';
                } else if(data.status === "ÇATDIRILDI") {
                    document.getElementById('mapPlaceholder').innerText = "Sifarişiniz uğurla çatdırıldı! Nuş olsun.";
                    document.getElementById('customerMapMarker').style.display = 'none';
                }
            }

            // [MƏTBƏX] Sifarişləri Yüklə
            async function loadKitchenOrders() {
                const response = await fetch('/api/kitchen/orders');
                const orders = await response.json();
                const container = document.getElementById('kitchenOrdersContainer');
                
                if(orders.length === 0) {
                    container.innerHTML = '<p style="color:#a4b0be; text-align:center;">Yeni sifariş yoxdur.</p>';
                    return;
                }

                container.innerHTML = orders.map(o => \`
                    <div style="background:#f1f2f6; padding:15px; border-radius:10px; margin-bottom:10px;">
                        <p style="margin:0 0 10px 0;"><b>Sifariş #\${o.id}</b> — \${o.items.join(', ')}</p>
                        <span class="status-badge">\${o.status}</span>
                        <button class="btn btn-primary" onclick="updateOrderStatus(\${o.id}, 'HAZIRDIR')">🍳 Hazırdır, Kuryer Çağır</button>
                    </div>
                \`).join('');
            }

            async function updateOrderStatus(id, status) {
                await fetch('/api/order/status', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, status })
                });
                alert('Mətbəx: Yemək hazırdır! Ən yaxın kuryerə bildiriş göndərildi.');
                loadKitchenOrders();
            }

            // [KURYER] Hazır Sifarişləri Yüklə
            async function loadCourierOrders() {
                const response = await fetch('/api/courier/orders');
                const orders = await response.json();
                const container = document.getElementById('courierOrdersContainer');
                
                if(orders.length === 0) {
                    container.innerHTML = '<p style="color:#a4b0be; text-align:center;">Hazır yemək yoxdur, mətbəxin bitirməsini gözləyin...</p>';
                    return;
                }

                container.innerHTML = orders.map(o => \`
                    <div style="background:#f1f2f6; padding:15px; border-radius:10px; margin-bottom:10px;">
                        <p style="margin:0;"><b>Sifariş #\${o.id}</b></p>
                        <p style="margin:5px 0; font-size:13px; color:#57606f;">📍 Ünvan: \${o.location}</p>
                        <button class="btn btn-success" onclick="acceptOrderByCourier(\${o.id})">🏍️ Sifarişi Qəbul Et (Yola Düş)</button>
                    </div>
                \`).join('');
            }

            async function acceptOrderByCourier(id) {
                await fetch('/api/order/status', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, status: 'KURYERDƏ (Yoldadır)' })
                });
                alert('Sifariş qəbul olundu! Xəritə naviqasiyası aktivdir.');
                document.getElementById('courierMapCard').style.display = 'block';
                loadCourierOrders();
            }

            async function completeDelivery() {
                await fetch('/api/order/status', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: currentOrderId, status: 'ÇATDIRILDI' })
                });
                alert('Təbriklər! Sifariş müştəriyə təslim edildi.');
                document.getElementById('courierMapCard').style.display = 'none';
                loadCourierOrders();
            }
        </script>
    </body>
    </html>
    `);
});

// BACKEND API LOGİKASI
app.post('/api/order', (req, res) => {
    const newOrder = { id: orders.length + 1, items: req.body.items, location: req.body.location, status: "GÖZLƏNİLİR (Mətbəxdə)" };
    orders.push(newOrder);
    res.status(201).json({ order: newOrder });
});

app.get('/api/order/:id', (req, res) => {
    const order = orders.find(o => o.id === parseInt(req.params.id));
    res.json(order || { status: "Tapılmadı" });
});

app.get('/api/kitchen/orders', (req, res) => {
    res.json(orders.filter(o => o.status.includes("GÖZLƏNİLİR")));
});

app.get('/api/courier/orders', (req, res) => {
    res.json(orders.filter(o => o.status === "HAZIRDIR"));
});

app.put('/api/order/status', (req, res) => {
    const order = orders.find(o => o.id === parseInt(req.body.id));
    if (order) order.status = req.body.status;
    res.json({ success: true });
});

app.listen(PORT, () => console.log(\`Running on port \${PORT}\`));
