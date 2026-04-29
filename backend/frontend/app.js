const API_URL = window.location.origin;

let AppState = {
    products: [], cart: [], favorites: [],
    coupons: [{ code: "BEMVINDO10", discount: 0.10 }, { code: "VIP20", discount: 0.20 }],
    appliedCoupon: null, currentUser: null, token: null,
    activeCategory: "all", searchTerm: "", sortType: "", minPrice: 0, maxPrice: 10000,
    filtersOpen: false, productsLoaded: false
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
});
const formatMoney = v => currencyFormatter.format(v);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function saveLocalCartFavs() {
    localStorage.setItem("edclaudia_cart", JSON.stringify(AppState.cart));
    localStorage.setItem("edclaudia_favorites", JSON.stringify(AppState.favorites));
}

function loadLocalCartFavs() {
    console.log('Carregando localStorage favoritos...');
    
    const c = localStorage.getItem("edclaudia_cart");
    AppState.cart = [];
    AppState.favorites = [];

    if (c) {
        try {
            const parsed = JSON.parse(c);
            AppState.cart = Array.isArray(parsed) ? parsed.filter(i => i && (i.id || i._id)) : [];
        } catch (e) {
            console.error('Erro ao parse cart:', e);
        }
    }
    
    const f = localStorage.getItem("edclaudia_favorites");
    if (f) {
        try {
            const parsed = JSON.parse(f);
            console.log('Parsed favoritos:', parsed);
            AppState.favorites = Array.isArray(parsed) ? parsed.filter(id => id && String(id).trim() !== "" && id !== "undefined" && id !== "null") : [];
            console.log('Filtrado favoritos:', AppState.favorites);
        } catch (e) {
            console.error('Erro ao parse favoritos:', e);
        }
    }
    
    console.log('Final favoritos array:', AppState.favorites, 'Length:', AppState.favorites.length);
    updateCartBadge(); updateFavBadge();
}

function updateCartBadge() {
    const total = AppState.cart.reduce((s, i) => s + (i.qty || 0), 0);
    const b = document.getElementById("cartCount");
    if (b) b.innerText = total;
}

function updateFavBadge() {
    const b = document.getElementById("favCount");
    if (b) {
        const count = AppState.favorites.length;
        b.innerText = count;
        b.style.display = count > 0 ? 'flex' : 'none';
        console.log('Favoritos badge atualizado:', count, 'Array:', AppState.favorites);
    }
}


async function loadProducts() {
    const app = document.getElementById("app");
    if (!app) {
        console.error("❌ Erro Crítico: O container <div id='app'> não foi encontrado no HTML. Verifique o index.html.");
        return;
    }

    // Inicia o estado de carregamento visual (limpa o texto 'Carregando produtos...')
    app.innerHTML = `<div class="skeleton-grid">${'<div class="skeleton-card"></div>'.repeat(4)}</div>`;

    try {
        console.log(`📡 Conectando à API: ${API_URL}/produtos...`);
        const res = await fetch(`${API_URL}/produtos`, { method: 'GET' });
        
        if (!res.ok) throw new Error(`Erro ${res.status}: Não foi possível buscar os produtos.`);
        
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("A resposta da API não é um array de produtos válido.");

        AppState.products = data;
        AppState.productsLoaded = true;
        renderCatalog();
    } catch (err) {
        console.error("❌ Erro ao conectar com a API de produtos:", err);
        app.innerHTML = `
            <div style="text-align:center;padding:4rem;color:var(--text-muted)">
                <i class="fas fa-exclamation-circle" style="font-size:3rem;margin-bottom:1rem;color:#ff6b6b"></i>
                <h3>Erro ao carregar produtos</h3>
                <p style="font-size:0.9rem; margin-top:0.5rem; color:#ff6b6b">Verifique a conexão com o banco de dados MongoDB.</p>
                <small>${err.message}</small>
                <br>
                <button onclick="loadProducts()" class="btn-primary" style="width:auto;margin-top:1.5rem">Tentar novamente</button>
            </div>`;
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

    if (!document.getElementById("productsGrid")) {
        app.innerHTML = `<div id="productsGrid" class="products-grid"></div>`;
    }

    const g = document.getElementById("productsGrid");
    if (!g) return;

    if (!f.length) {
        g.innerHTML = '<div style="text-align:center;padding:5rem;color:var(--text-muted);grid-column:1/-1;width:100%"><h3>Nenhum produto encontrado nesta busca</h3></div>';
        return;
    }
    g.innerHTML = f.map(p => {
        const pid = p.id || p._id;
        const isFav = AppState.favorites.some(favId => String(favId) === String(pid));
        const stockWarning = p.stock > 0 && p.stock < 10 ? `<div class="stock-warning">Restam apenas ${p.stock} unids!</div>` : '';
        
        return `<div class="product-card" data-id="${pid}">${getBadge(p)}
            <div class="product-img-wrapper">
                <img src="${p.image}" class="product-img" alt="${p.name}" loading="lazy">
            </div>
            <div class="product-info"><div class="product-category">${p.category}</div>
            <div class="product-title">${p.name}</div>
            ${stockWarning}
            <div class="product-price">${formatMoney(p.price)}</div>
            <div class="product-actions">
                <button class="btn-cart" data-id="${pid}"><i class="fas fa-cart-plus"></i> Adicionar</button>
                <button class="btn-fav ${isFav?'active':''}" data-id="${pid}"><i class="fas fa-heart"></i></button>
            </div></div></div>`;
    }).join('');

    renderFilterModalUI(); // Atualiza a UI do modal com os estados atuais
    document.querySelectorAll(".btn-cart").forEach(b => b.onclick = e => { e.stopPropagation(); addToCart(b.dataset.id); });
    document.querySelectorAll(".btn-fav").forEach(b => b.onclick = e => { e.stopPropagation(); toggleFavorite(b.dataset.id); });
    document.querySelectorAll(".product-card").forEach(c => c.onclick = () => showProductModal(c.dataset.id));
}

function renderFilterModalUI() {
    const cats = [
        {id: 'all', label: 'Todos'},
        {id: 'Novidades', label: 'Novidades ✨'},
        {id: 'Natura', label: 'Natura'},
        {id: 'O Boticário', label: 'O Boticário'},
        {id: 'Avon', label: 'Avon'},
        {id: 'Kits', label: 'Kits & Presentes 🎁'},
        {id: 'Acessórios', label: 'Acessórios'}
    ];

    const container = document.getElementById("modalCategories");
    if (container) {
        container.innerHTML = cats.map(c => `
            <button class="cat-filter-btn ${AppState.activeCategory === c.id ? 'active' : ''}" 
                    onclick="selectCategory('${c.id}')">${c.label}</button>
        `).join('');
    }
}

window.selectCategory = function(cat) {
    AppState.activeCategory = cat;
    renderCatalog();
};

function setupFilterListeners() {
    document.getElementById("minPModal")?.addEventListener("input", e => { AppState.minPrice = +e.target.value || 0; renderCatalog(); });
    document.getElementById("maxPModal")?.addEventListener("input", e => { AppState.maxPrice = +e.target.value || 10000; renderCatalog(); });
    document.getElementById("sortSModal")?.addEventListener("change", e => { AppState.sortType = e.target.value; renderCatalog(); });
}

window.addToCart = function(id) {
    let item = AppState.cart.find(i => String(i.id||i._id) === String(id));
    if (item) item.qty++;
    else { const prod = AppState.products.find(p => String(p.id||p._id) === String(id)); if (prod) AppState.cart.push({...prod, qty:1}); }
    saveLocalCartFavs(); updateCartBadge();
    Swal.fire({ title: "Adicionado!", icon: "success", timer: 1200, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
};

window.toggleFavorite = function(id) {
    if (!id || id === 'undefined') return;
    const sid = String(id);
    const idx = AppState.favorites.findIndex(favId => String(favId) === sid);
    
    console.log('Toggle favorite:', sid, 'Index found:', idx, 'Array atual:', AppState.favorites);
    
    if (idx > -1) {
        AppState.favorites.splice(idx, 1);
        console.log('Removido favorito');
    } else {
        AppState.favorites.push(sid);
        console.log('Adicionado favorito');
    }
    
    saveLocalCartFavs();
    updateFavBadge();
    renderCatalog();
};

function showProductModal(id) {
    const p = AppState.products.find(p => String(p.id||p._id) === String(id));
    if (!p) return;
    const d = document.getElementById("productDetail");
    if (!d) return;

    const isFav = AppState.favorites.some(favId => String(favId) === String(id));
    const desc = p.description || "Sem descrição.";

    const related = AppState.products
        .filter(item => item.category === p.category && String(item.id || item._id) !== String(id))
        .slice(0, 3);

    d.innerHTML = `
        <h2>${p.name}</h2>
        <div class="product-category">${p.category}</div>
        <img src="${p.image}" style="width:100%;border-radius:1rem;margin:1rem 0" alt="${p.name}">

        <div class="product-info-menu">
            <div class="menu-section active">
                <button class="menu-header" onclick="this.parentElement.classList.toggle('active')">
                    <span><i class="fas fa-info-circle"></i> Descrição</span>
                    <i class="fas fa-chevron-down"></i>
                </button>
                <div class="menu-content">
                    <p style="color:var(--text-light);line-height:1.7">${desc}</p>
                </div>
            </div>
        </div>

        <div class="product-price" style="font-size:1.8rem;margin:1rem 0">${formatMoney(p.price)}</div>
        <div style="display:flex;gap:1rem;margin-top:1rem">
            <button class="btn-primary" id="mAdd" style="flex:1"><i class="fas fa-cart-plus"></i> Adicionar ao Carrinho</button>
            <button class="btn-fav ${isFav?'active':''}" id="mFav" style="width:50px;height:50px;border-radius:50%"><i class="fas fa-heart"></i></button>
        </div>

        ${related.length > 0 ? `
        <div class="related-section">
            <h4 style="margin-bottom:1rem">Você também pode gostar:</h4>
            <div class="related-grid">
                ${related.map(r => `
                    <div class="related-item" onclick="showProductModal('${r.id || r._id}')">
                        <img src="${r.image}">
                        <div style="font-weight:600">${r.name.substring(0, 15)}...</div>
                        <div style="color:var(--primary)">${formatMoney(r.price)}</div>
                    </div>
                `).join('')}
            </div>
        </div>` : ''}`;

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
        const checkoutBtn = document.querySelector('.btn-primary[onclick*="checkoutWhatsApp"]');
        if (checkoutBtn) checkoutBtn.style.display = 'none';
        return;
    }

        el.innerHTML = `

        
        <div class="luxury-branding">
            <i class="fas fa-crown gold-crown"></i>
            <h2 class="luxury-brand-name">EDCLÁUDIA RIBEIRO</h2>
        </div>

        <div class="luxury-checkout-form" style="display: grid; gap: 1rem; margin-bottom: 2rem;">
            <div class="luxury-input-group">
                <input type="text" id="checkName" class="luxury-field" style="width:100%" value="${AppState.currentUser?.name || ''}" placeholder="NOME COMPLETO">
            </div>
            <div class="luxury-input-group">
                <input type="text" id="checkAddress" class="luxury-field" style="width:100%" placeholder="ENDEREÇO DE ENTREGA">
            </div>
        </div>

        <div class="luxury-cart-grid">
            ${AppState.cart.map(item => `
                <div class="luxury-cart-item-new">
                    <div class="gold-frame">
                        <img src="${item.image}" alt="${item.name}">
                    </div>
                    <div class="item-info">
                        <div style="font-family:'Inter', sans-serif; font-weight:700; color:#FFF; font-size:1rem; text-transform:uppercase; margin-bottom:4px;">${item.name}</div>
                        <div style="font-family:'Playfair Display', serif; color:var(--bronze); font-size:0.9rem;">${item.qty}x ${formatMoney(item.price)}</div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-family:'Inter', sans-serif; color:var(--text-muted); font-size:0.8rem; margin-bottom:8px;">Subtotal: ${formatMoney(item.price * item.qty)}</div>
                        <button onclick="removeFromCart('${item.id||item._id}')" class="btn-trash-minimal">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>`).join('')}
        </div>`;

    const sub = getCartTotal(), disc = getDiscount(), fin = getFinalTotal();
    let html = '';
    if (AppState.appliedCoupon) {
        html += `<div style="font-size:0.9rem;color:var(--text-muted);text-decoration:line-through">${formatMoney(sub)}</div>`;
        html += `<div style="font-size:0.85rem;color:var(--success);margin-bottom:0.3rem"><i class="fas fa-tag"></i> ${AppState.appliedCoupon.code}: -${formatMoney(disc)}</div>`;
    }
    
    document.getElementById("cartTotal").innerHTML = '';

    const checkoutBtn = document.querySelector('.btn-primary[onclick*="checkoutWhatsApp"]');
    if (checkoutBtn) {
        checkoutBtn.className = 'btn-checkout-premium';
        checkoutBtn.innerHTML = `<i class="fab fa-whatsapp"></i> FINALIZAR PEDIDO VIA WHATSAPP • ${formatMoney(fin)}`;
    }
}

window.removeFromCart = id => {
    AppState.cart = AppState.cart.filter(i => String(i.id||i._id) !== String(id));
    saveLocalCartFavs(); updateCartBadge(); renderCartModal();
};

window.checkoutWhatsApp = async () => {
    if (!AppState.cart.length) {
        Swal.fire({ title: "Carrinho vazio", icon: "warning", confirmButtonColor: "#C9A96E" });
        return;
    }

    if (!AppState.currentUser) {
        Swal.fire({ title: "Atenção", text: "Você precisa estar logado para finalizar o pedido.", icon: "info", confirmButtonColor: "#C9A96E" });
        openModal("authModal");
        return;
    }

    try {
        const orderBody = {
            items: AppState.cart.map(i => ({ id: i.id || i._id, name: i.name, price: i.price, qty: i.qty, image: i.image })),
            total: getFinalTotal(),
            address: "WhatsApp Checkout",
            paymentMethod: "whatsapp"
        };

        Swal.fire({ title: "Processando...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });

        const res = await fetch(`${API_URL}/pedidos`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${AppState.token}` },
            body: JSON.stringify(orderBody)
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Erro ao registrar pedido");
        }
        
        Swal.close();
    } catch (err) {
        Swal.fire({ title: "Erro no Checkout", text: err.message, icon: "error", confirmButtonColor: "#C9A96E" });
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
    msg += `*Cliente:* ${AppState.currentUser.name}%0A`;
    msg += `*Email:* ${AppState.currentUser.email}%0A%0A`;
    msg += `Olá! Gostaria de finalizar meu pedido. 😊`;

    AppState.cart = []; saveLocalCartFavs(); updateCartBadge();
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

function renderFavoritesModal() {
    const favs = AppState.products.filter(p => AppState.favorites.some(favId => String(favId) === String(p.id||p._id)));
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
    const userName = AppState.currentUser?.name || "Emanuel";
    localStorage.removeItem("authToken");
    AppState.token = null; AppState.currentUser = null; AppState.appliedCoupon = null;
    updateUIForUser();
    
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = "farewellModal";
    modal.style.display = "flex";
    modal.innerHTML = `
        <div class="modal-content luxury-modal" style="text-align:center; padding:3rem">
            <div style="font-size:4rem; color:var(--bronze); margin-bottom:1rem"><i class="fas fa-door-open"></i></div>
            <h2 style="font-family:'Playfair Display'; color:var(--bronze); font-size:2.5rem; letter-spacing:3px">ATÉ BREVE!</h2>
            <p style="color:var(--text-light); margin-bottom:2.5rem">Sua sessão foi encerrada, ${userName}.</p>
            <div style="display:flex; flex-direction:column; gap:1rem">
                <button class="btn-primary btn-metallic" onclick="location.reload()">VOLTAR À LOJA</button>
                <button class="btn-secondary" onclick="openModal('authModal'); this.closest('.modal').remove()" style="border-color:var(--bronze); color:var(--bronze)">FAZER LOGIN NOVAMENTE</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
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
    const filterToggle = document.getElementById("filterToggle");
    if (filterToggle) {
        filterToggle.onclick = () => openModal("filterModal");
    }
    setupFilterListeners();

    const loginBtn = document.getElementById("loginBtn");
    if (loginBtn) loginBtn.onclick = (e) => { e.preventDefault(); openModal("authModal"); };

    const registerBtn = document.getElementById("registerBtn");
    if (registerBtn) registerBtn.onclick = (e) => {
        e.preventDefault();
        const tabRegister = document.querySelector('[data-tab="register"]');
        if (tabRegister) tabRegister.click();
        openModal("authModal");
    };

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.onclick = (e) => { e.preventDefault(); logout(); };

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

    document.getElementById("themeToggle")?.addEventListener("click", () => document.body.classList.toggle("dark"));
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

    document.getElementById("profileLink")?.addEventListener("click", (e) => { e.preventDefault(); showProfile(); });
    document.getElementById("ordersLink")?.addEventListener("click", (e) => { e.preventDefault(); showOrderHistory(); });
    document.getElementById("adminPanelLink")?.addEventListener("click", (e) => {
        e.preventDefault();
        if (AppState.currentUser?.role === "admin") window.location.href = "/admin";
        else Swal.fire({ title: "Acesso negado", icon: "error", confirmButtonColor: "#C9A96E" });
    });

    document.getElementById("doLoginBtn")?.addEventListener("click", () => {
        login(document.getElementById("loginEmail")?.value, document.getElementById("loginPassword")?.value);
    });
    document.getElementById("doRegisterBtn")?.addEventListener("click", () => {
        register(document.getElementById("regName")?.value, document.getElementById("regEmail")?.value, document.getElementById("regPassword")?.value);
    });

    document.querySelectorAll(".close").forEach(b => b.onclick = function() { closeModal(this.closest(".modal").id); });
    window.onclick = e => { if (e.target.classList.contains("modal")) closeModal(e.target.id); };

    document.querySelectorAll(".tab-btn").forEach(b => b.onclick = () => {
        document.querySelectorAll(".tab-btn").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        const isLogin = b.dataset.tab === "login";
        const targetForm = document.getElementById(isLogin ? "loginForm" : "registerForm");
        const otherForm = document.getElementById(isLogin ? "registerForm" : "loginForm");
        
        otherForm.style.display = "none";
        targetForm.style.display = "block";
        targetForm.classList.add("fade-in");
        setTimeout(() => targetForm.classList.remove("fade-in"), 500);
    });

    document.getElementById("searchBtn")?.addEventListener("click", () => {
        AppState.searchTerm = document.getElementById("globalSearch")?.value || "";
        renderCatalog();
    });
    document.getElementById("globalSearch")?.addEventListener("keyup", debounce((e) => { AppState.searchTerm = e.target.value; renderCatalog(); }, 300));

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});

    const applyCoupon = document.getElementById("applyCouponBtn");
    if (applyCoupon) applyCoupon.onclick = () => {
        const code = document.getElementById("couponInput")?.value?.trim()?.toUpperCase();
        const cupom = AppState.coupons.find(c => c.code === code);
        if (cupom) {
            AppState.appliedCoupon = cupom;
            renderCartModal();
            applyCoupon.classList.add("pulse-gold");
            Swal.fire({ title: "Cupom aplicado!", text: cupom.code, icon: "success", timer: 1500, showConfirmButton: false, confirmButtonColor: "#C9A96E" });
        } else {
            applyCoupon.classList.remove("pulse-gold");
            Swal.fire({ title: "Cupom inválido", icon: "error", confirmButtonColor: "#C9A96E" });
        }
    };
}

function showProfile() {
    if (!AppState.currentUser) return;
    const modal = document.getElementById("profileModal");
    const content = modal.querySelector('.modal-content');
    content.classList.add('luxury-modal');

    const d = document.getElementById("profileInfo");
    if (d) d.innerHTML = `
        <div style="text-align:center; padding:1rem">
            <div class="er-logo-mark">
                <i class="fas fa-crown" style="color:var(--bronze); font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
                <span style="font-family:'Playfair Display'; color:var(--bronze); letter-spacing: 3px; font-size: 0.7rem; text-transform: uppercase;">Edcláudia Ribeiro</span>
            </div>
            <i class="fas fa-check-circle bronze-check"></i>
            <h2 style="font-family:'Playfair Display'; color:#FFF; font-size:2.2rem; margin-bottom:0.5rem">Bem-vindo!</h2>
            <p style="color:var(--text-light); font-size:1.1rem; margin-bottom:2.5rem; font-style: italic;">Olá, ${AppState.currentUser.name}!</p>
            <div style="background:rgba(201,169,110,0.1); border:1px solid rgba(201,169,110,0.3); padding:1.5rem; border-radius:4px; margin-bottom:2rem">
                <p style="font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; color:var(--bronze); margin-bottom: 5px;">Sessão Ativa</p>
                <p style="font-weight:400; color:white; font-family:'Inter'">${AppState.currentUser.email}</p>
            </div>
            <button class="btn-metallic" onclick="closeModal('profileModal')" style="padding:1rem 4rem; width: auto;">OK</button>
        </div>`;
    openModal("profileModal");
}

window.reopenWhatsApp = (orderId) => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o meu pedido #${orderId.toString().slice(-6)}. Pode me ajudar?`);
    window.open(`https://wa.me/5588981078835?text=${msg}`, '_blank');
};

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
                        <button onclick="reopenWhatsApp('${o.id || o._id}')" class="btn-cart" style="width:auto;padding:0.3rem 0.8rem;font-size:0.7rem;background:linear-gradient(135deg,#25D366,#128C7E)">
                            <i class="fab fa-whatsapp"></i> Contato
                        </button>
                    </div>
                </div>`).join('');
        }
        openModal("historyModal");
    } catch { Swal.fire({ title: "Erro", text: "Não foi possível carregar histórico", icon: "error", confirmButtonColor: "#C9A96E" }); }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("dark");
    
    bindAllEvents();
    loadLocalCartFavs();
    checkAuthToken();
    await loadProducts();
});
