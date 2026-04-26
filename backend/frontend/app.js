const API_URL = "http://localhost:3000";

let AppState = {
    products: [], cart: [], favorites: [],
    coupons: [{ code: "BEMVINDO10", discount: 0.10 }, { code: "VIP20", discount: 0.20 }],
    appliedCoupon: null, currentUser: null, token: null,
    activeCategory: "all", searchTerm: "", sortType: "", minPrice: 0, maxPrice: 1000
};

const formatMoney = v => `R$ ${v.toFixed(2).replace('.', ',')}`;
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function saveLocalCartFavs() {
    localStorage.setItem("edclaudia_cart", JSON.stringify(AppState.cart));
    localStorage.setItem("edclaudia_favorites", JSON.stringify(AppState.favorites));
}

function loadLocalCartFavs() {
    const c = localStorage.getItem("edclaudia_cart");
    if (c) AppState.cart = JSON.parse(c);
    const f = localStorage.getItem("edclaudia_favorites");
    if (f) AppState.favorites = JSON.parse(f);
    updateCartBadge(); updateFavBadge();
}

function updateCartBadge() {
    const total = AppState.cart.reduce((s, i) => s + (i.qty || 0), 0);
    const b = document.getElementById("cartCount");
    if (b) b.innerText = total;
}

function updateFavBadge() {
    const b = document.getElementById("favCount");
    if (b) b.innerText = AppState.favorites.length;
}

async function loadProducts() {
    try {
        const res = await fetch(`${API_URL}/produtos`);
        AppState.products = await res.json();
        renderCatalog();
    } catch {
        Swal.fire({ title: "Erro", text: "Não foi possível carregar produtos", icon: "error", confirmButtonColor: "#C9A96E" });
    }
}

function getBadge(p) {
    if (p.badge === 'bestseller' || (p.sales || 0) >= 20) return '<span class="product-badge bestseller">Mais Vendido</span>';
    if (p.badge === 'new') return '<span class="product-badge new">Lançamento</span>';
    if (p.badge === 'sale') return '<span class="product-badge sale">Promoção</span>';
    return '';
}

function renderCatalog() {
    let f = AppState.products.filter(p => {
        const cat = AppState.activeCategory === "all" || p.category === AppState.activeCategory;
        const pr = p.price >= AppState.minPrice && p.price <= AppState.maxPrice;
        const sr = p.name.toLowerCase().includes(AppState.searchTerm.toLowerCase());
        return cat && pr && sr;
    });
    if (AppState.sortType === "price_asc") f.sort((a, b) => a.price - b.price);
    if (AppState.sortType === "price_desc") f.sort((a, b) => b.price - a.price);
    if (AppState.sortType === "sales") f.sort((a, b) => (b.sales || 0) - (a.sales || 0));

    const app = document.getElementById("app");
    if (!app) return;
    app.innerHTML = `
        <div class="filters-bar">
            <div class="filter-group"><label>Min:</label><input type="number" id="minP" value="${AppState.minPrice}"></div>
            <div class="filter-group"><label>Max:</label><input type="number" id="maxP" value="${AppState.maxPrice}"></div>
            <div class="filter-group"><label>Ordenar:</label>
                <select id="sortS"><option value="">Relevância</option>
                <option value="price_asc" ${AppState.sortType==="price_asc"?"selected":""}>Menor preço</option>
                <option value="price_desc" ${AppState.sortType==="price_desc"?"selected":""}>Maior preço</option>
                <option value="sales" ${AppState.sortType==="sales"?"selected":""}>Mais vendidos</option></select>
            </div>
            <div class="filter-group"><span>${f.length} produto${f.length!==1?'s':''}</span></div>
        </div>
        <div class="products-grid" id="productsGrid"></div>`;

    document.getElementById("minP").onchange = e => { AppState.minPrice = +e.target.value; renderCatalog(); };
    document.getElementById("maxP").onchange = e => { AppState.maxPrice = +e.target.value; renderCatalog(); };
    document.getElementById("sortS").onchange = e => { AppState.sortType = e.target.value; renderCatalog(); };

    const g = document.getElementById("productsGrid");
    if (!f.length) { g.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted);grid-column:1/-1"><h3>Nenhum produto encontrado</h3></div>'; return; }

    g.innerHTML = f.map(p => {
        const pid = p.id || p._id;
        const isFav = AppState.favorites.includes(String(pid));
        return `<div class="product-card" data-id="${pid}">${getBadge(p)}
            <div class="product-img-wrapper">
                <img src="${p.image}" class="product-img" alt="${p.name}" loading="lazy">
            </div>
            <div class="product-info"><div class="product-category">${p.category}</div>
            <div class="product-title">${p.name}</div>
            <div class="product-price">${formatMoney(p.price)}</div>
            <div class="product-actions">
                <button class="btn-cart" data-id="${pid}"><i class="fas fa-cart-plus"></i> Adicionar</button>
                <button class="btn-fav ${isFav?'active':''}" data-id="${pid}"><i class="fas fa-heart"></i></button>
            </div></div></div>`;
    }).join('');

    document.querySelectorAll(".btn-cart").forEach(b => b.onclick = e => { e.stopPropagation(); addToCart(b.dataset.id); });
    document.querySelectorAll(".btn-fav").forEach(b => b.onclick = e => { e.stopPropagation(); toggleFavorite(b.dataset.id); });
    document.querySelectorAll(".product-card").forEach(c => c.onclick = () => showProductModal(c.dataset.id));
}

window.addToCart = function(id) {
    let item = AppState.cart.find(i => String(i.id||i._id) === String(id));
    if (item) item.qty++;
    else { const prod = AppState.products.find(p => String(p.id||p._id) === String(id)); if (prod) AppState.cart.push({...prod, qty:1}); }
    saveLocalCartFavs(); updateCartBadge();
    Swal.fire({ title: "Adicionado!", icon: "success", timer: 1200, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
};

window.toggleFavorite = function(id) {
    const sid = String(id), idx = AppState.favorites.indexOf(sid);
    if (idx > -1) AppState.favorites.splice(idx, 1); else AppState.favorites.push(sid);
    saveLocalCartFavs(); updateFavBadge(); renderCatalog();
};

function showProductModal(id) {
    const p = AppState.products.find(p => String(p.id||p._id) === String(id));
    if (!p) return;
    const d = document.getElementById("productDetail");
    if (!d) return;
    d.innerHTML = `<h2>${p.name}</h2><div class="product-category">${p.category}</div>
        <img src="${p.image}" style="width:100%;border-radius:1rem;margin:1rem 0" alt="${p.name}">
        <p style="color:var(--text-light);line-height:1.7">${p.description||"Sem descrição."}</p>
        <div class="product-price" style="font-size:1.8rem;margin:1rem 0">${formatMoney(p.price)}</div>
        <div style="display:flex;gap:1rem;margin-top:1rem">
            <button class="btn-primary" id="mAdd" style="flex:1"><i class="fas fa-cart-plus"></i> Adicionar</button>
            <button class="btn-fav ${AppState.favorites.includes(String(id))?'active':''}" id="mFav" style="width:50px;height:50px"><i class="fas fa-heart"></i></button>
        </div>`;
    document.getElementById("mAdd").onclick = () => addToCart(id);
    document.getElementById("mFav").onclick = () => toggleFavorite(id);
    openModal("productModal");
}

const getCartTotal = () => AppState.cart.reduce((s, i) => s + i.price * (i.qty || 0), 0);
const getDiscount = () => AppState.appliedCoupon ? getCartTotal() * AppState.appliedCoupon.discount : 0;
const getFinalTotal = () => Math.max(0, getCartTotal() - getDiscount());

function renderCartModal() {
    const el = document.getElementById("cartItems");
    if (!el) return;
    if (!AppState.cart.length) {
        el.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted)"><i class="fas fa-shopping-bag" style="font-size:3rem;display:block;opacity:0.3;margin-bottom:1rem"></i><p>Carrinho vazio</p></div>';
        document.getElementById("cartTotal").innerHTML = formatMoney(0);
        return;
    }
    el.innerHTML = AppState.cart.map(item => `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;padding:0.75rem;background:var(--light-bg);border-radius:12px">
            <div style="display:flex;align-items:center;gap:0.75rem">
                <img src="${item.image}" style="width:50px;height:50px;object-fit:cover;border-radius:8px" alt="${item.name}">
                <div>
                    <div style="font-weight:600">${item.name}</div>
                    <div style="font-size:0.85rem;color:var(--text-light)">${formatMoney(item.price)} x ${item.qty}</div>
            </div>
            <div style="display:flex;align-items:center;gap:0.5rem">
                <strong style="color:var(--primary-dark)">${formatMoney(item.price * item.qty)}</strong>
                <button onclick="removeFromCart('${item.id||item._id}')" style="background:var(--accent);border:none;color:white;border-radius:50%;width:28px;height:28px;cursor:pointer"><i class="fas fa-times" style="font-size:0.7rem"></i></button>
            </div>`).join('');

    const sub = getCartTotal(), disc = getDiscount(), fin = getFinalTotal();
    let html = '';
    if (AppState.appliedCoupon) {
        html += `<div style="font-size:0.9rem;color:var(--text-muted);text-decoration:line-through">${formatMoney(sub)}</div>`;
        html += `<div style="font-size:0.85rem;color:var(--success);margin-bottom:0.3rem"><i class="fas fa-tag"></i> ${AppState.appliedCoupon.code}: -${formatMoney(disc)}</div>`;
    }
    html += `<div style="font-size:1.5rem;color:var(--primary-dark);font-weight:800;font-family:'Playfair Display',serif">${formatMoney(fin)}</div>`;
    document.getElementById("cartTotal").innerHTML = html;
}

window.removeFromCart = id => {
    AppState.cart = AppState.cart.filter(i => String(i.id||i._id) !== String(id));
    saveLocalCartFavs(); updateCartBadge(); renderCartModal();
};

window.checkoutWhatsApp = () => {
    if (!AppState.cart.length) {
        Swal.fire({ title: "Carrinho vazio", icon: "warning", confirmButtonColor: "#C9A96E" });
        return;
    }
    let msg = "*🛍️ Pedido Edcláudia Ribeiro*%0A%0A";
    AppState.cart.forEach(i => {
        msg += `• ${i.name} x${i.qty} = ${formatMoney(i.price*i.qty)}%0A`;
    });
    const sub = getCartTotal(), disc = getDiscount(), fin = getFinalTotal();
    msg += `%0A─────────────────%0A`;
    msg += `*Subtotal:* ${formatMoney(sub)}%0A`;
    if (disc > 0) msg += `*Desconto:* -${formatMoney(disc)}%0A`;
    msg += `*TOTAL:* ${formatMoney(fin)}%0A`;
    msg += `─────────────────%0A%0A`;
    msg += `Olá! Gostaria de finalizar meu pedido. 😊`;
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

function renderFavoritesModal() {
    const favs = AppState.products.filter(p => AppState.favorites.includes(String(p.id||p._id)));
    const el = document.getElementById("favoritesList");
    if (!el) return;
    if (!favs.length) { el.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted)"><i class="fas fa-heart" style="font-size:3rem;display:block;opacity:0.3;margin-bottom:1rem"></i><p>Sem favoritos</p></div>'; return; }
    el.innerHTML = favs.map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem;background:var(--light-bg);border-radius:12px;margin-bottom:0.5rem">
            <div style="display:flex;align-items:center;gap:0.75rem">
                <img src="${p.image}" style="width:40px;height:40px;object-fit:cover;border-radius:8px" alt="${p.name}">
                <div>
                    <div style="font-weight:600;font-size:0.9rem">${p.name}</div>
                    <div style="color:var(--primary-dark);font-weight:700">${formatMoney(p.price)}</div>
            </div>
            <button onclick="addToCart('${p.id||p._id}')" class="btn-primary" style="width:auto;padding:0.5rem 1rem;font-size:0.8rem"><i class="fas fa-cart-plus"></i></button>
        </div>`).join('');
}

async function login(email, password) {
    try {
        const res = await fetch(`${API_URL}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({email, password}) });
        if (!res.ok) throw new Error("Login inválido");
        const data = await res.json();
        AppState.token = data.token; AppState.currentUser = data.user;
        localStorage.setItem("authToken", data.token);
        updateUIForUser();
        Swal.fire({ title: "Bem-vindo!", text: `Olá, ${data.user.name}!`, icon: "success", confirmButtonColor: "#C9A96E" });
        renderCatalog(); closeModal("authModal");
    } catch (err) { Swal.fire({ title: "Erro", text: err.message, icon: "error", confirmButtonColor: "#C9A96E" }); }
}

async function register(name, email, password) {
    try {
        const res = await fetch(`${API_URL}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({name, email, password}) });
        if (!res.ok) throw new Error("Email já existe");
        const data = await res.json();
        AppState.token = data.token; AppState.currentUser = data.user;
        localStorage.setItem("authToken", data.token);
        updateUIForUser();
        Swal.fire({ title: "Sucesso!", text: "Cadastro realizado!", icon: "success", confirmButtonColor: "#C9A96E" });
        renderCatalog(); closeModal("authModal");
    } catch (err) { Swal.fire({ title: "Erro", text: err.message, icon: "error", confirmButtonColor: "#C9A96E" }); }
}

function logout() {
    localStorage.removeItem("authToken");
    AppState.token = null; AppState.currentUser = null; AppState.appliedCoupon = null;
    updateUIForUser();
    Swal.fire({ title: "Até logo!", icon: "info", confirmButtonColor: "#C9A96E" });
    renderCatalog();
}

function checkAuthToken() {
    const t = localStorage.getItem("authToken");
    if (!t) return;
    try {
        const p = JSON.parse(atob(t.split(".")[1]));
        AppState.token = t; AppState.currentUser = { id: p.id, name: p.name, email: p.email, role: p.role };
        updateUIForUser();
    } catch { localStorage.removeItem("authToken"); }
}

function updateUIForUser() {
    const isAdmin = AppState.currentUser?.role === "admin";
    const al = document.getElementById("adminPanelLink");
    if (al) al.style.display = isAdmin ? "inline-block" : "none";
    const pl = document.getElementById("profileLink"); if (pl) pl.style.display = AppState.currentUser ? "block" : "none";
    const ol = document.getElementById("ordersLink"); if (ol) ol.style.display = AppState.currentUser ? "block" : "none";
    const lb = document.getElementById("logoutBtn"); if (lb) lb.style.display = AppState.currentUser ? "block" : "none";
    const li = document.getElementById("loginBtn"); if (li) li.style.display = AppState.currentUser ? "none" : "block";
    const ri = document.getElementById("registerBtn"); if (ri) ri.style.display = AppState.currentUser ? "none" : "block";
}

function openModal(id) { const m = document.getElementById(id); if (m) { m.style.display = "flex"; document.body.style.overflow = "hidden"; } }
function closeModal(id) { const m = document.getElementById(id); if (m) { m.style.display = "none"; document.body.style.overflow = ""; } }

function bindAllEvents() {
    const loginBtn = document.getElementById("loginBtn");
    if (loginBtn) loginBtn.onclick = () => openModal("authModal");

    const registerBtn = document.getElementById("registerBtn");
    if (registerBtn) registerBtn.onclick = () => {
        const tabRegister = document.querySelector('[data-tab="register"]');
        if (tabRegister) tabRegister.click();
        openModal("authModal");
    };

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.onclick = () => logout();

    const cartIcon = document.getElementById("cartIcon");
    if (cartIcon) cartIcon.onclick = () => { openModal("cartModal"); renderCartModal(); };

    const favoritesIcon = document.getElementById("favoritesIcon");
    if (favoritesIcon) favoritesIcon.onclick = () => { openModal("favoritesModal"); renderFavoritesModal(); };

    const userBtn = document.getElementById("userBtn");
    if (userBtn) {
        userBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const dd = document.getElementById("userDropdown");
            if (dd) dd.classList.toggle("show");
        });
    }

    document.addEventListener("click", (e) => {
        const dd = document.getElementById("userDropdown");
        const um = document.querySelector('.user-menu');
        if (dd && um && !um.contains(e.target)) dd.classList.remove("show");
    });

    document.getElementById("themeToggle").onclick = () => document.body.classList.toggle("dark");
    document.getElementById("chatFab").onclick = () => openModal("chatModal");
    document.getElementById("sendChatBtn").onclick = () => {
        const inp = document.getElementById("chatInput");
        const msg = inp?.value?.trim();
        if (msg) {
            const md = document.getElementById("chatMessages");
            md.innerHTML += `<p style="margin-bottom:0.5rem"><strong style="color:var(--primary-dark)">Você:</strong> ${msg}</p>`;
            inp.value = ""; md.scrollTop = md.scrollHeight;
            setTimeout(() => { md.innerHTML += `<p style="margin-bottom:0.5rem"><strong style="color:var(--primary-dark)">Suporte:</strong> Obrigado! Em breve retornaremos.</p>`; md.scrollTop = md.scrollHeight; }, 800);
        }
    };

    document.getElementById("profileLink").onclick = (e) => { e.preventDefault(); showProfile(); };
    document.getElementById("ordersLink").onclick = (e) => { e.preventDefault(); showOrderHistory(); };
    document.getElementById("adminPanelLink").onclick = () => {
        if (AppState.currentUser?.role === "admin") window.location.href = "/admin";
        else Swal.fire({ title: "Acesso negado", icon: "error", confirmButtonColor: "#C9A96E" });
    };

    document.getElementById("doLoginBtn").onclick = () => {
        login(document.getElementById("loginEmail")?.value, document.getElementById("loginPassword")?.value);
    };
    document.getElementById("doRegisterBtn").onclick = () => {
        register(document.getElementById("regName")?.value, document.getElementById("regEmail")?.value, document.getElementById("regPassword")?.value);
    };

    document.querySelectorAll(".close").forEach(b => b.onclick = function() { closeModal(this.closest(".modal").id); });
    window.onclick = e => { if (e.target.classList.contains("modal")) closeModal(e.target.id); };

    document.querySelectorAll(".tab-btn").forEach(b => b.onclick = () => {
        document.querySelectorAll(".tab-btn").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        document.getElementById("loginForm").style.display = b.dataset.tab === "login" ? "block" : "none";
        document.getElementById("registerForm").style.display = b.dataset.tab === "register" ? "block" : "none";
    });

    document.querySelectorAll(".cat-link").forEach(l => l.onclick = (e) => {
        e.preventDefault();
        document.querySelectorAll(".cat-link").forEach(x => x.classList.remove("active"));
        l.classList.add("active");
        AppState.activeCategory = l.dataset.cat;
        renderCatalog();
    });

    document.getElementById("searchBtn").onclick = () => {
        AppState.searchTerm = document.getElementById("globalSearch")?.value || "";
        renderCatalog();
    };
    document.getElementById("globalSearch").onkeyup = debounce((e) => { AppState.searchTerm = e.target.value; renderCatalog(); }, 300);

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center;margin-bottom:1.5rem">
            <div style="width:80px;height:80px;background:linear-gradient(135deg,var(--primary),var(--primary-dark));border-radius:50%;margin:0 auto 1rem;display:flex;align-items:center;justify-content:center;color:var(--secondary);font-size:2rem;font-weight:700">${AppState.currentUser.name.charAt(0)}</div>
            <h3 style="font-family:'Playfair Display',serif">${AppState.currentUser.name}</h3>
        </div>
        <div style="background:var(--light-bg);padding:1rem;border-radius:12px">
            <p style="margin-bottom:0.5rem"><strong>Email:</strong> ${AppState.currentUser.email}</p>
            <p><strong>Tipo:</strong> ${AppState.currentUser.role==="admin"?"Administrador":"Cliente"}</p>
        </div>`;
    openModal("profileModal");
}

async function showOrderHistory() {
    if (!AppState.currentUser) return;
    try {
        const res = await fetch(`${API_URL}/pedidos/usuario`, { headers: { "Authorization": `Bearer ${AppState.token}` } });
        const orders = await res.json();
        const el = document.getElementById("historyList");
        if (!el) return;
        if (!orders.length) {
            el.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted)"><i class="fas fa-history" style="font-size:2rem;display:block;margin-bottom:0.5rem"></i><p>Sem pedidos</p></div>';
        } else {
            el.innerHTML = orders.map(o => `
                <div style="background:var(--light-bg);padding:1rem;border-radius:12px;margin-bottom:0.75rem">
                    <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem">
                        <strong style="color:var(--primary-dark)">#${o.id||o._id?.toString().slice(-6)}</strong>
                        <span style="font-size:0.8rem;color:var(--text-muted)">${new Date(o.date).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div style="font-size:0.85rem;color:var(--text-light);margin-bottom:0.3rem">${o.items.length} item(s)</div>
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <span style="font-weight:700">${formatMoney(o.total)}</span>
                        <span style="padding:0.2rem 0.6rem;border-radius:20px;font-size:0.75rem;font-weight:600;background:${o.status==='Aprovado'?'rgba(78,205,196,0.2)':'var(--primary)'};color:${o.status==='Aprovado'?'var(--success)':'var(--secondary)'}">${o.status}</span>
                    </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
    bindAllEvents();
});
