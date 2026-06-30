const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Müvəqqəti Data Saxlanğıcı
let orders = [];
let restaurants = [
    { 
        id: 1, 
        name: "Dadlı Restoran (Mərkəz)", 
        img: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=60",
        tags: "Pizza • Burger • Dönər",
        time: "15-25 dəq",
        menu: [
            { id: 101, name: "Dönər Çörəkdə (Mal əti)", price: 4.5, desc: "Təzə tərəvəzlər və xüsusi sous ilə" }, 
            { id: 102, name: "Miks Pizza (Böyük)", price: 12.0, desc: "Mozarella, göbələk, pomidor, salam" }
        ] 
    },
    { 
        id: 2, 
        name: "Seyfəli FastFood", 
        img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=60",
        tags: "Burger • Dönər • Soyuq İçkilər",
        time: "20-30 dəq",
        menu: [
            { id: 201, name: "Kral Burger", price: 6.5, desc: "150qr kotlet, turşu xiyar, çedar pendiri" }, 
            { id: 202, name: "Soyuq Ayran", price: 1.0, desc: "Yerli və təbii süddən" }
        ] 
    }
];

// MÜASİR VİZUAL MÜŞTƏRİ PANELİ
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="az">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Catd-r — Sifariş Paneli</title>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        <style>
            :root { --primary: #ff4757; --bg: #f8f9fa; --dark: #2f3542; }
            body { font-family: '-apple-system', BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: var(--bg); margin: 0; padding: 0; color: var(--dark); padding-bottom: 100px; }
            
            /* Navbar */
            .navbar { background: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.05); position: sticky; top: 0; z-index: 100; }
            .logo { font-size: 22px; font-weight: 800; color: var(--primary); display: flex; align-items: center; gap: 8px; }
            
            .container { max-width: 500px; margin: 0 auto; padding: 15px; }
            
            /* Banner */
            .banner { background: linear-gradient(135deg, #ff4757, #ff6b81); color: white; padding: 25px 20px; border-radius: 16px; margin-bottom: 20px; box-shadow: 0 6px 15px rgba(255, 71, 87, 0.2); }
            .banner h1 { margin: 0; font-size: 24px; font-weight: 700; }
            .banner p { margin: 5px 0 0 0; opacity: 0.9; font-size: 14px; }

            h2 { font-size: 18px; font-weight: 700; margin-bottom: 15px; }

            /* Restoran Kartları */
            .restaurant-card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03); margin-bottom: 15px; cursor: pointer; transition: 0.2s; border: 1px solid #eee; }
            .restaurant-card:hover { transform: translateY(-2px); }
            .restaurant-img { width: 100%; height: 160px; object-fit: cover; }
            .restaurant-info { padding: 15px; position: relative; }
            .restaurant-name { font-size: 17px; font-weight: 700; margin: 0; }
            .restaurant-tags { color: #747d8c; font-size: 13px; margin: 5px 0 0 0; }
            .restaurant-badge { position: absolute; right: 15px; top: 15px; background: #f1f2f6; padding: 5px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; color: var(--dark); }

            /* Menyu Siyahısı */
            .menu-list { display: none; margin-top: 10px; }
            .back-btn { background: none; border: none; color: var(--primary); font-weight: bold; font-size: 15px; cursor: pointer; display: flex; align-items: center; gap: 5px; margin-bottom: 15px; padding: 0; }
            .menu-item { background: white; padding: 15px; border-radius: 14px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #eee; }
            .menu-details { flex: 1; padding-right: 10px; }
            .menu-title { font-weight: 700; margin: 0; font-size: 15px; }
            .menu-desc { color: #747d8c; font-size: 12px; margin: 4px 0 0 0; }
            .menu-price { font-weight: 700; color: var(--primary); margin-top: 5px; font-size: 15px; }
            .add-btn { background: #ff4757; color: white; border: none; padding: 8px 14px; border-radius: 20px; font-weight: bold; cursor: pointer; font-size: 13px; }

            /* Səbət Alt Paneli */
            .cart-bar { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); width: 90%; max-width: 460px; background: white; padding: 15px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); display: none; box-sizing: border-box; z-index: 1000; border: 1px solid #eee; }
            .cart-title { margin: 0 0 10px 0; font-size: 15px; font-weight: 700; }
            .address-input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 10px; font-size: 14px; margin-bottom: 10px; box-sizing: border-box; }
            .order-btn { background: #2ed573; color: white; border: none; width: 100%; padding: 14px; border-radius: 10px; font-weight: 700; font-size: 15px; cursor: pointer; }

            /* Canlı Status Paneli */
            .status-card { background: white; border-radius: 16px; padding: 20px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.05); display: none; border: 1px solid #eee; }
            .status-pulse { width: 60px; height: 60px; background: rgba(255, 71, 87, 0.1); color: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; margin: 0 auto 15px auto; animation: pulse 2s infinite; }
            @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.4); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(255, 71, 87, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 71, 87, 0); } }
            .status-text { font-size: 18px; font-weight: bold; color: var(--dark); margin-bottom: 5px; }
            .refresh-btn { background: #1e90ff; color: white; border: none; padding: 10px 20px; border-radius: 10px; margin-top: 15px; font-weight: bold; cursor: pointer; width: 100%; }
        </style>
    </head>
    <body>

        <div class="navbar">
            <div class="logo"><i class="fas fa-motorcycle"></i> Catd-r</div>
            <div style="font-size: 18px; color: var(--dark);"><i class="far fa-user-circle"></i></div>
        </div>

        <div class="container">
            <div class="banner" id="topBanner">
                <h1>Açlığı Saniyələr İçində Həll Et!</h1>
                <p>Ən yaxın restoranlardan sürətli çatdırılma.</p>
            </div>

            <div id="restaurantsSection">
                <h2>Seçilən Restoranlar</h2>
                <div id="restaurantsContainer"></div>
            </div>

            <div id="menuSection" class="menu-list">
                <button class="back-btn" onclick="showRestaurants()"><i class="fas fa-arrow-left"></i> Restoranlara qayıt</button>
                <h2 id="selectedRestaurantName">Menyu</h2>
                <div id="menuItemsContainer"></div>
            </div>

            <div id="trackingSection" class="status-card">
                <div class="status-pulse"><i class="fas fa-utensils"></i></div>
                <div class="status-text" id="statusDisplay">Sifarişiniz Göndərilir...</div>
                <p style="color:#747d8c; font-size:13px; margin:0;">Restoran sifarişi qəbul edəndə bura yenilənəcək.</p>
                <button class="refresh-btn" onclick="checkStatus()"><i class="fas fa-sync-alt"></i> Statusu Yenilə</button>
            </div>
        </div>

        <div class="cart-bar" id="cartBar">
            <p class="cart-title" id="cartTotalText">Səbət: 1 məhsul — 0 AZN</p>
            <input type="text" class="address-input" id="addressInput" placeholder="Çatdırılma ünvanını tam yazın...">
            <button class="order-btn" onclick="submitOrder()">✔️ Sifarişi Təsdiqlə</button>
        </div>

        <script>
            const restaurantsData = ${JSON.stringify(restaurants)};
            let currentCart = null;
            let currentOrderId = null;

            function renderRestaurants() {
                const container = document.getElementById('restaurantsContainer');
                container.innerHTML = restaurantsData.map(r => \`
                    <div class="restaurant-card" onclick="openMenu(\${r.id})">
                        <img class="restaurant-img" src="\${r.img}">
                        <div class="restaurant-info">
                            <p class="restaurant-name">\${r.name}</p>
                            <p class="restaurant-tags">\${r.tags}</p>
                            <span class="restaurant-badge"><i class="far fa-clock"></i> \${r.time}</span>
                        </div>
                    </div>
                \`).join('');
            }

            function openMenu(id) {
                const restaurant = restaurantsData.find(r => r.id === id);
                document.getElementById('selectedRestaurantName').innerText = restaurant.name;
                document.getElementById('restaurantsSection').style.display = 'none';
                document.getElementById('topBanner').style.display = 'none';
                document.getElementById('menuSection').style.display = 'block';

                const container = document.getElementById('menuItemsContainer');
                container.innerHTML = restaurant.menu.map(item => \`
                    <div class="menu-item">
                        <div class="menu-details">
                            <p class="menu-title">\${item.name}</p>
                            <p class="menu-desc">\${item.desc}</p>
                            <p class="menu-price">\${item.price.toFixed(2)} AZN</p>
                        </div>
                        <button class="add-btn" onclick="addToCart(\${restaurant.id}, \${item.id}, '\${item.name}', \${item.price})">Əlavə et</button>
                    </div>
                \`).join('');
            }

            function showRestaurants() {
                document.getElementById('menuSection').style.display = 'none';
                document.getElementById('cartBar').style.display = 'none';
                document.getElementById('restaurantsSection').style.display = 'block';
                document.getElementById('topBanner').style.display = 'block';
                currentCart = null;
            }

            function addToCart(resId, itemId, name, price) {
                currentCart = { resId, itemId, name, price };
                document.getElementById('cartTotalText').innerText = \`Səbətinizdə: \${name} — \${price.toFixed(2)} AZN\`;
                document.getElementById('cartBar').style.display = 'block';
            }

            async function submitOrder() {
                const address = document.getElementById('addressInput').value;
                if(!address) {
                    alert('Zəhmət olmasa çatdırılma ünvanını yazın!');
                    return;
                }

                const response = await fetch('/api/customer/order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        restaurantId: currentCart.resId,
                        items: [currentCart.name],
                        customerLocation: address
                    })
                });
                
                const data = await response.json();
                currentOrderId = data.order.id;
                
                document.getElementById('menuSection').style.style.display = 'none';
                document.getElementById('cartBar').style.display = 'none';
                document.getElementById('trackingSection').style.display = 'block';
                document.getElementById('statusDisplay').innerText = data.order.status;
            }

            async function checkStatus() {
                if(!currentOrderId) return;
                const response = await fetch('/api/customer/track/' + currentOrderId);
                const data = await response.json();
                document.getElementById('statusDisplay').innerText = data.orderStatus;
            }

            renderRestaurants();
        </script>
    </body>
    </html>
    `);
});

// SERVERİN APİ ARXAFON YOLLARI (Əvvəlki funksionallıq qorunub saxlanılıb)
app.post('/api/customer/order', (req, res) => {
    const { restaurantId, items, customerLocation } = req.body;
    const newOrder = {
        id: orders.length + 1,
        restaurantId,
        items,
        customerLocation,
        status: "GÖZLƏNİLİR (Mətbəx panelinə düşdü)",
        courierId: null
    };
    orders.push(newOrder);
    res.status(201).json({ message: "Sifariş yaradıldı", order: newOrder });
});

app.get('/api/customer/track/:orderId', (req, res) => {
    const order = orders.find(o => o.id === parseInt(req.params.orderId));
    if (!order) return res.status(404).json({ message: "Sifariş tapılmadı" });
    res.json({ orderStatus: order.status });
});

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
