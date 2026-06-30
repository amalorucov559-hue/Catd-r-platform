const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Müvəqqəti Data Saxlanğıcı
let orders = [];
let restaurants = [
    { id: 1, name: "Dadlı Restoran (Mərkəz)", menu: [{ id: 101, name: "Dönər Çörəkdə", price: 4.5 }, { id: 102, name: "Miks Pizza", price: 12 }] },
    { id: 2, name: "Seyfəli FastFood", menu: [{ id: 201, name: "Kral Burger", price: 6.5 }, { id: 202, name: "Soyuq Ayran", price: 1.0 }] }
];
let couriers = [
    { id: 1, name: "Kuryer Raul", lat: 40.68, lng: 46.03, status: "available" }
];

// VİZUAL MÜŞTƏRİ PANELİ (HTML / CSS / JavaScript birbaşa serverin daxilində)
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="az">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Catd-r Platform - Müştəri Paneli</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #333; }
            header { background-color: #ff4757; color: white; padding: 15px; text-align: center; border-radius: 10px; margin-bottom: 20px; font-size: 24px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .container { max-width: 600px; margin: 0 auto; }
            .card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 20px; }
            h2 { color: #ff4757; margin-top: 0; border-bottom: 2px solid #f4f6f9; padding-bottom: 10px; }
            select, button, input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ddd; border-radius: 8px; font-size: 16px; box-sizing: border-box; }
            button { background-color: #2ed573; color: white; border: none; font-weight: bold; cursor: pointer; transition: 0.2s; }
            button:hover { background-color: #26af5f; }
            .menu-item { display: flex; justify-content: space-between; background: #f9f9f9; padding: 10px; margin: 5px 0; border-radius: 6px; border-left: 4px solid #ff4757; }
            .status-box { background-color: #dfe4ea; padding: 15px; border-radius: 8px; text-align: center; font-weight: bold; font-size: 18px; margin-top: 10px; color: #2f3542; }
        </style>
    </head>
    <body>
        <div class="container">
            <header>🏍️ Catd-r Çatdırılma</header>
            
            <div class="card">
                <h2>1. Restoran Seçin</h2>
                <select id="restaurantSelect" onchange="loadMenu()">
                    <option value="">-- Restoran seçin --</option>
                    ${restaurants.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
                </select>
                <div id="menuContainer"></div>
            </div>

            <div class="card" id="orderCard" style="display:none;">
                <h2>2. Çatdırılma Ünvanı</h2>
                <input type="text" id="locationInput" placeholder="Ünvanınızı yazın (məs: Şəmkir, Nizami küç.)">
                <button onclick="giveOrder()">🛒 Sifarişi Tamamla</button>
            </div>

            <div class="card" id="trackingCard" style="display:none;">
                <h2>📦 Sifarişinizin Statusu</h2>
                <div id="statusDisplay" class="status-box">Gözlənilir...</div>
                <p style="text-align:center; color:#777; font-size:14px;">Mətbəx sifarişi qəbul edəndə status anlıq yenilənəcək.</p>
                <button onclick="checkStatus()" style="background-color:#1e90ff;">🔄 Statusu Yenilə</button>
            </div>
        </div>

        <script>
            let selectedRestaurantId = null;
            let currentOrderId = null;
            const restaurantsData = ${JSON.stringify(restaurants)};

            function loadMenu() {
                const select = document.getElementById('restaurantSelect');
                selectedRestaurantId = select.value;
                const menuContainer = document.getElementById('menuContainer');
                const orderCard = document.getElementById('orderCard');
                
                if(!selectedRestaurantId) {
                    menuContainer.innerHTML = '';
                    orderCard.style.display = 'none';
                    return;
                }

                const restaurant = restaurantsData.find(r => r.id == selectedRestaurantId);
                let menuHtml = '<h3>Menyu:</h3>';
                restaurant.menu.forEach(item => {
                    menuHtml += \`
                        <div class="menu-item">
                            <span>\${item.name}</span>
                            <strong>\${item.price} AZN</strong>
                        </div>
                    \`;
                });
                menuContainer.innerHTML = menuHtml;
                orderCard.style.display = 'block';
            }

            async function giveOrder() {
                const location = document.getElementById('locationInput').value;
                if(!location) {
                    alert('Zəhmət olmasa ünvanı qeyd edin!');
                    return;
                }

                const response = await fetch('/api/customer/order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        restaurantId: parseInt(selectedRestaurantId),
                        items: ["Test Yemək"],
                        customerLocation: location
                    })
                });
                const data = await response.json();
                currentOrderId = data.order.id;
                
                alert(data.message);
                document.getElementById('trackingCard').style.style.display = 'block';
                document.getElementById('statusDisplay').innerText = data.order.status;
                document.getElementById('trackingCard').scrollIntoView({ behavior: 'smooth' });
            }

            async function checkStatus() {
                if(!currentOrderId) return;
                const response = await fetch('/api/customer/track/' + currentOrderId);
                const data = await response.json();
                document.getElementById('statusDisplay').innerText = data.orderStatus;
            }
        </script>
    </body>
    </html>
    `);
});

// API YOLLARI (Arxa fon məntiqləri)
app.get('/api/customer/restaurants', (req, res) => res.json(restaurants));

app.post('/api/customer/order', (req, res) => {
    const { restaurantId, items, customerLocation } = req.body;
    const newOrder = {
        id: orders.length + 1,
        restaurantId,
        items,
        customerLocation,
        status: "GÖZLƏNİLİR (Mətbəxdə)",
        courierId: null
    };
    orders.push(newOrder);
    res.status(201).json({ message: "Sifarişiniz mətbəxə ötürüldü!", order: newOrder });
});

app.get('/api/customer/track/:orderId', (req, res) => {
    const order = orders.find(o => o.id === parseInt(req.params.orderId));
    if (!order) return res.status(404).json({ message: "Sifariş tapılmadı" });
    res.json({ orderStatus: order.status });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
