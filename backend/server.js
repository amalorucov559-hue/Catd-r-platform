const express = require('express');
const app = express();
app.use(express.json());

// Port Sazlaması (Railway üçün dinamik port)
const PORT = process.env.PORT || 3000;

// Müvəqqəti Data Saxlanğıcı (Baza qoşulana qədər datalar yaddaşda saxlanılır)
let orders = [];
let restaurants = [
    { id: 1, name: "Dadlı Restoran", menu: [{ id: 101, name: "Dönər", price: 4.5 }, { id: 102, name: "Pizza", price: 12 }] },
    { id: 2, name: "Seyfəli Dönər", menu: [{ id: 201, name: "Burger", price: 6 }, { id: 202, name: "Ayran", price: 1 }] }
];
let couriers = [
    { id: 1, name: "Kuryer Raul", lat: 40.68, lng: 46.03, status: "available" } // Gəncə/Şəmkir koordinatları üçün test
];

// ==========================================
// 1. SİFARİŞÇİ (MÜŞTƏRİ) YOLLARI
// ==========================================

// Ana Səhifə Testi
app.get('/', (req, res) => {
    res.json({ message: "Catd-r Platform API Aktivdir! Sistem tam gücü ilə işləyir." });
});

// Restoranların siyahısını görmək
app.get('/api/customer/restaurants', (req, res) => {
    res.json(restaurants);
});

// Sifariş vermək
app.post('/api/customer/order', (req, res) => {
    const { restaurantId, items, customerLocation } = req.body;
    const newOrder = {
        id: orders.length + 1,
        restaurantId,
        items,
        customerLocation,
        status: "GÖZLƏNİLİR (Mətbəxdə)", // Statuslar: GÖZLƏNİLİR, HAZIRLANIR, HAZIRDIR, KURYERDƏ, ÇATDIRILDI
        courierId: null
    };
    orders.push(newOrder);
    res.status(201).json({ message: "Sifariş uğurla restorana göndərildi!", order: newOrder });
});

// Sifarişin statusunu və kuryerin harada olduğunu izləmək
app.get('/api/customer/track/:orderId', (req, res) => {
    const order = orders.find(o => o.id === parseInt(req.params.orderId));
    if (!order) return res.status(404).json({ message: "Sifariş tapılmadı" });
    
    let courierInfo = null;
    if (order.courierId) {
        courierInfo = couriers.find(c => c.id === order.courierId);
    }
    
    res.json({ orderStatus: order.status, courierLocation: courierInfo ? { lat: courierInfo.lat, lng: courierInfo.lng } : "Kuryer hələ təyin olunmayıb" });
});


// ==========================================
// 2. RESTORAN VƏ MƏTBƏX YOLLARI
// ==========================================

// Restorana gələn sifarişləri görmək
app.get('/api/restaurant/orders/:restaurantId', (req, res) => {
    const resOrders = orders.filter(o => o.restaurantId === parseInt(req.params.restaurantId));
    res.json(resOrders);
});

// Restoranın sifarişi qəbul etməsi və ya statusu dəyişməsi (Hazırlanır / Hazırdır)
app.put('/api/restaurant/order/:orderId', (req, res) => {
    const order = orders.find(o => o.id === parseInt(req.params.orderId));
    if (!order) return res.status(404).json({ message: "Sifariş tapılmadı" });
    
    const { status } = req.body; // "HAZIRLANIR" və ya "HAZIRDIR"
    order.status = status;
    
    res.json({ message: `Sifariş statusu yeniləndi: ${status}`, order });
});


// ==========================================
// 3. KURYER YOLLARI
// ==========================================

// Kuryerin öz canlı koordinatlarını serverə bildirməsi (Xəritədə izləmə üçün)
app.post('/api/courier/location', (req, res) => {
    const { courierId, lat, lng } = req.body;
    const courier = couriers.find(c => c.id === courierId);
    if (courier) {
        courier.lat = lat;
        courier.lng = lng;
        return res.json({ message: "Koordinat yeniləndi", courier });
    }
    res.status(404).json({ message: "Kuryer tapılmadı" });
});

// Kuryerin yaxınlıqdakı "HAZIRDIR" statuslu sifarişləri görməsi
app.get('/api/courier/available-orders', (req, res) => {
    const availableOrders = orders.filter(o => o.status === "HAZIRDIR");
    res.json(availableOrders);
});

// Kuryerin sifarişi götürməsi (Qəbul etməsi)
app.put('/api/courier/accept-order', (req, res) => {
    const { courierId, orderId } = req.body;
    const order = orders.find(o => o.id === orderId);
    if (!order) return res.status(404).json({ message: "Sifariş tapılmadı" });
    
    order.courierId = courierId;
    order.status = "KURYERDƏ (Yoldadır)";
    res.json({ message: "Sifariş kuryer tərəfindən götürüldü, müştəri sizi izləyir!", order });
});


// ==========================================
// 4. ADMİN PANEL YOLLARI
// ==========================================

// Bütün sistemdəki restoranları, kuryerləri və sifarişləri idarə etmək üçün
app.get('/api/admin/dashboard', (req, res) => {
    res.json({ totalOrders: orders.length, totalRestaurants: restaurants.length, totalCouriers: couriers.length, allOrders: orders });
});

// Yeni restoran əlavə etmək
app.post('/api/admin/add-restaurant', (req, res) => {
    const { name, menu } = req.body;
    const newRes = { id: restaurants.length + 1, name, menu: menu || [] };
    restaurants.push(newRes);
    res.json({ message: "Yeni restoran sistemə əlavə edildi!", restaurant: newRes });
});

// Serveri İşə Salmaq
app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda aktivdir.`);
});
