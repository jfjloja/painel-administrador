
// --- CONFIGURATION ---
(async function () {

    const SUPABASE_URL = 'https://awcmwwhxtwdwfqhtahec.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3Y213d2h4dHdkd2ZxaHRhaGVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwOTAyNDksImV4cCI6MjA4NTY2NjI0OX0.TGYfoqV5H7VPjYFRk-yPh5cPzr2pL5cBXtJy_5kRsCA';

    let supabase;

    try {
        if (!window.supabase) throw new Error("Supabase Library Not Loaded");
        // Use window.supabaseClient to avoid redeclaration if script runs twice
        if (!window.supabaseClient) {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }
        supabase = window.supabaseClient;
        console.log("Supabase Client Init OK");
    } catch (err) {
        console.error("Critical Init Error:", err);
        alert("Erro Crítico: O sistema não carregou corretamente. Verifique sua internet e recarregue a página.");
        return;
    }

    // --- STATE ---
    let currentUser = null;
    let currentProducts = [];
    let editingId = null;

    // Multi-upload state
    let filesToUpload = []; // Array of File objects
    let currentImageUrls = []; // Array of strings (existing URLs)

    // --- INITIALIZATION ---
    document.addEventListener('DOMContentLoaded', async () => {
        console.log("Admin JS Initializing...");

        if (!supabase) {
            console.error("Supabase not initialized. Aborting.");
            return;
        }

        // Global Auth Check
        const { data: { session } } = await supabase.auth.getSession();
        console.log("Session Status:", session);

        // ROUTER: Check which page we are on based on elements
        const loginForm = document.getElementById('login-form');
        const adminGrid = document.getElementById('admin-grid');

        if (loginForm) {
            // Admin JS should not run on login page anymore (it has inline script)
            console.log("On Login Page - stopping admin.js execution");
            return;
        }

        // Check if we are on the admin dashboard (renamed to index.html for GitHub Pages)
        else if (adminGrid) {
            console.log("Detected Admin Page");
            if (!session) {
                console.log("No session, redirecting to login...");
                window.location.href = 'login.html';
            } else {
                currentUser = session.user;
                const userDisplay = document.getElementById('admin-user');
                if (userDisplay) userDisplay.innerText = currentUser.email;
                setupDashboard();
            }
        }
    });

    // --- DASHBOARD LOGIC ---
    function setupDashboard() {
        // Buttons
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.onclick = async () => {
                await supabase.auth.signOut();
                window.location.href = 'login.html';
            };
        }

        const btnAdd = document.getElementById('btn-add-new');
        if (btnAdd) btnAdd.onclick = () => openModal();

        const btnClose = document.getElementById('close-modal');
        if (btnClose) btnClose.onclick = closeModal;

        // IMAGE UPLOAD LOGIC
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('image-input');

        if (uploadArea && fileInput) {
            uploadArea.onclick = () => fileInput.click();

            fileInput.onchange = (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    const newFiles = Array.from(e.target.files);
                    const totalAfterAdd = currentImageUrls.length + filesToUpload.length + newFiles.length;

                    // Limit to 5 images
                    if (totalAfterAdd > 5) {
                        alert('Apenas 5 fotos são permitidas por item.');
                        fileInput.value = '';
                        return;
                    }

                    // Append new files
                    filesToUpload = [...filesToUpload, ...newFiles];

                    // Render Gallery
                    renderGallery();

                    // Reset input so same file can be selected again if needed
                    fileInput.value = '';
                }
            };
        }

        // Form Submit
        const productForm = document.getElementById('product-form');
        if (productForm) productForm.onsubmit = handleSaveProduct;

        // Password Change
        setupPasswordModal();

        // Products Search Bar Logic
        const searchInput = document.getElementById('admin-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase().trim();
                filterProductsByName(query);
            });
        }

        // Orders Search Bar Logic
        const ordersSearchInput = document.getElementById('orders-search');
        if (ordersSearchInput) {
            ordersSearchInput.addEventListener('input', () => {
                applyAllOrderFilters();
            });
        }

        // Video Search Bar Logic
        const videoSearchInput = document.getElementById('admin-video-search');
        if (videoSearchInput) {
            videoSearchInput.addEventListener('input', (e) => {
                renderVideoGrid(e.target.value);
            });
        }

        // Date Filter Logic
        const filterMonth = document.getElementById('filter-month');
        const filterYear = document.getElementById('filter-year');

        if (filterMonth) {
            filterMonth.addEventListener('change', () => applyAllOrderFilters());
        }
        if (filterYear) {
            filterYear.addEventListener('change', () => applyAllOrderFilters());
        }

        // Tab Navigation
        setupTabs();

        // Emergency Toggle
        setupEmergencyToggle();

        // Load Data
        fetchProducts();
    }

    // --- TAB NAVIGATION ---
    function setupTabs() {
        const tabs = document.querySelectorAll('.admin-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;

                // Update tab buttons
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Update tab content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`tab-${tabName}`).classList.add('active');

                // Load orders when switching to orders tab
                if (tabName === 'orders') {
                    fetchOrders();
                }

                // Load videos when switching to videos tab
                if (tabName === 'videos') {
                    renderVideoGrid();
                }
            });
        });
    }

    // --- GALLERY LOGIC ---
    function renderGallery() {
        const container = document.getElementById('gallery-preview');
        if (!container) return;

        container.innerHTML = '';
        const uploadPlaceholder = document.getElementById('upload-placeholder');

        const totalImages = currentImageUrls.length + filesToUpload.length;

        // Hide placeholder if we have images, show (and keep button available) effectively
        // Actually, we want the button ALWAYS available to add MORE photos, 
        // but maybe change text? For now, keep it simple.

        // Render Existing URLs
        currentImageUrls.forEach((url, index) => {
            const div = document.createElement('div');
            div.className = 'gallery-item';
            div.innerHTML = `
                <img src="${url}">
                <button type="button" class="gallery-remove" onclick="window.removeExistingImage(${index})">
                    <i class="fa-solid fa-times"></i>
                </button>
            `;
            container.appendChild(div);
        });

        // Render New Files
        filesToUpload.forEach((file, index) => {
            const url = URL.createObjectURL(file);
            const div = document.createElement('div');
            div.className = 'gallery-item';
            div.innerHTML = `
                <img src="${url}">
                <button type="button" class="gallery-remove" onclick="window.removeNewFile(${index})">
                    <i class="fa-solid fa-times"></i>
                </button>
            `;
            container.appendChild(div);
        });
    }

    // Make global so onclick works
    window.removeExistingImage = (index) => {
        currentImageUrls.splice(index, 1);
        renderGallery();
    };

    window.removeNewFile = (index) => {
        filesToUpload.splice(index, 1);
        renderGallery();
    };

    // --- PASSWORD MODAL LOGIC ---
    function setupPasswordModal() {
        window.openPasswordModal = () => {
            const modal = document.getElementById('password-modal');
            if (!modal) return;
            modal.classList.add('open');
            const err = document.getElementById('pass-error');
            if (err) err.classList.add('hidden');
            const form = document.getElementById('password-form');
            if (form) form.reset();

            const close = document.getElementById('close-pass-modal');
            if (close) close.onclick = () => modal.classList.remove('open');

            if (form) form.onsubmit = handlePasswordSubmit;
        };
    }

    async function handlePasswordSubmit(e) {
        e.preventDefault();
        const newPass = document.getElementById('new-password').value;
        const btnSave = document.getElementById('btn-save-pass');
        const errorEl = document.getElementById('pass-error');

        if (newPass.length < 6) {
            errorEl.innerText = 'Senha deve ter pelo menos 6 caracteres';
            errorEl.classList.remove('hidden');
            return;
        }

        btnSave.disabled = true;
        btnSave.innerText = 'Atualizando...';

        const { error } = await supabase.auth.updateUser({ password: newPass });

        if (error) {
            errorEl.innerText = 'Erro: ' + error.message;
            errorEl.classList.remove('hidden');
        } else {
            alert('Senha atualizada com sucesso!');
            document.getElementById('password-modal').classList.remove('open');
        }
        btnSave.disabled = false;
        btnSave.innerText = 'Atualizar Senha';
    }

    async function fetchProducts() {
        setLoading(true);
        const { data, error } = await supabase
            .from('store_items')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error) {
            currentProducts = data;
            renderGrid(data);
        }
        setLoading(false);
    }

    // Filter products by name for search
    function filterProductsByName(query) {
        console.log("Searching for:", query, "Products count:", currentProducts.length);
        if (!query) {
            renderGrid(currentProducts);
            return;
        }
        const filtered = currentProducts.filter(p => {
            const name = p.name ? p.name.toLowerCase() : '';
            return name.includes(query);
        });
        console.log("Found:", filtered.length, "results");
        renderGrid(filtered);
    }

    function renderGrid(products) {
        const grid = document.getElementById('admin-grid');
        if (!grid) return;
        grid.innerHTML = '';

        products.forEach(p => {
            const card = document.createElement('div');
            card.className = 'card admin-card';

            // Parse image safely
            let img = 'https://via.placeholder.com/300';
            if (p.images && p.images.length > 0) img = p.images[0];
            else if (p.image_url) img = p.image_url;

            // Make functions global
            window.editProduct = (id) => {
                const p = currentProducts.find(x => x.id === id);
                if (p) openModal(p);
            };

            window.deleteProduct = async (id) => {
                if (!confirm('Tem certeza? Essa ação não pode ser desfeita.')) return;
                setLoading(true);
                const { error } = await supabase.from('store_items').delete().eq('id', id);
                if (error) {
                    alert('Erro ao apagar: ' + error.message);
                } else {
                    fetchProducts();
                }
                setLoading(false);
            };

            // Basic Info
            card.innerHTML = `
                <div class="card-image-wrapper">
                    <img src="${img}" class="card-image">
                </div>
                <div class="card-content">
                    <div class="card-category">${p.category}</div>
                    <h3 class="card-title">${p.name}</h3>
                    <div class="card-price">R$ ${p.price}</div>
                    
                    <div class="admin-card-actions">
                        <button class="btn-edit" onclick="editProduct('${p.id}')">
                            <i class="fa-solid fa-pen"></i> Editar
                        </button>
                        <button class="btn-delete" onclick="deleteProduct('${p.id}')">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    // --- MODAL & SAVING ---

    function openModal(product = null) {
        editingId = product ? product.id : null;

        // Reset State
        filesToUpload = [];
        currentImageUrls = [];

        // Reset Form
        document.getElementById('product-form').reset();

        // Checkboxes
        document.querySelectorAll('.size-check input').forEach(c => c.checked = false);

        // Title
        document.getElementById('modal-title').innerText = product ? 'Editar Produto' : 'Novo Produto';

        if (product) {
            // Fill Data
            document.getElementById('p-name').value = product.name;
            document.getElementById('p-price').value = product.price;
            document.getElementById('p-category').value = product.category;
            document.getElementById('p-new').checked = product.is_new;
            document.getElementById('p-sale').checked = product.is_on_sale;
            document.getElementById('p-stock').checked = product.is_out_of_stock;

            // Fill Sizes
            if (product.sizes) {
                product.sizes.forEach(s => {
                    const cb = document.querySelector(`.size-check input[value="${s}"]`);
                    if (cb) cb.checked = true;
                });
            }

            // Images
            if (product.images && product.images.length > 0) {
                currentImageUrls = [...product.images];
            } else if (product.image_url) {
                currentImageUrls = [product.image_url];
            }
        }

        renderGallery();
        document.getElementById('product-modal').classList.add('open');
    }

    function closeModal() {
        document.getElementById('product-modal').classList.remove('open');
        filesToUpload = []; // Clear memory
    }

    // --- SAVE LOGIC ---
    async function handleSaveProduct(e) {
        e.preventDefault();

        const btn = document.getElementById('btn-save');
        const errorEl = document.getElementById('form-error');

        btn.disabled = true;
        btn.innerText = 'Salvando...';
        errorEl.classList.add('hidden');

        try {
            // 1. Gather Data
            const name = document.getElementById('p-name').value;
            const price = parseFloat(document.getElementById('p-price').value);
            const category = document.getElementById('p-category').value;
            const isNew = document.getElementById('p-new').checked;

            const isSale = document.getElementById('p-sale').checked;
            const isStock = document.getElementById('p-stock').checked;

            const selectedSizes = Array.from(document.querySelectorAll('.size-check input:checked')).map(cb => cb.value);

            // 2. Upload New Images
            let newImageUrls = [];

            if (filesToUpload.length > 0) {
                // Upload sequentially to avoid overwhelming browser or connection
                for (const file of filesToUpload) {
                    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    const { data, error } = await supabase.storage
                        .from('Products')
                        .upload(fileName, file);

                    if (error) throw error;

                    const { data: { publicUrl } } = supabase.storage.from('Products').getPublicUrl(fileName);
                    newImageUrls.push(publicUrl);
                }
            }

            // Combine old URLs and new URLs
            // NOTE: currentImageUrls contains the old ones we KEPT. 
            // If user removed one from UI, it's gone from this array.
            const finalImages = [...currentImageUrls, ...newImageUrls];

            // 3. Save to DB
            const payload = {
                name,
                price,
                category,
                sizes: selectedSizes,
                images: finalImages,
                is_new: isNew,
                is_on_sale: isSale,
                is_out_of_stock: isStock
            };

            let dbError;

            if (editingId) {
                // UPDATE
                const { error } = await supabase
                    .from('store_items')
                    .update(payload)
                    .eq('id', editingId);
                dbError = error;
            } else {
                // INSERT
                const { error } = await supabase
                    .from('store_items')
                    .insert([payload]);
                dbError = error;
            }

            if (dbError) throw dbError;

            // Success
            closeModal();
            fetchProducts();
            alert('Produto salvo com sucesso!');

        } catch (err) {
            console.error(err);
            errorEl.innerText = 'Erro ao salvar: ' + (err.message || err);
            errorEl.classList.remove('hidden');
        } finally {
            btn.disabled = false;
            btn.innerText = 'Salvar Produto';
        }
    }

    function setLoading(isLoading) {
        const el = document.getElementById('loading');
        if (!el) return;
        if (isLoading) el.classList.remove('hidden');
        else el.classList.add('hidden');
    }

    // =========================================================
    // ORDER MANAGEMENT FUNCTIONS
    // =========================================================

    let currentOrders = [];

    async function fetchOrders() {
        setLoading(true);
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            currentOrders = data;
            renderOrders(data);
            populateYearFilter();
        } else {
            console.error('Error fetching orders:', error);
        }
        setLoading(false);
    }

    function renderOrders(orders) {
        const container = document.getElementById('orders-container');
        const emptyState = document.getElementById('orders-empty');
        if (!container) return;

        if (!orders || orders.length === 0) {
            container.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');
        container.innerHTML = '';

        // Sort orders: Entregue (shipped) goes to bottom
        const sortedOrders = [...orders].sort((a, b) => {
            if (a.status === 'shipped' && b.status !== 'shipped') return 1;
            if (a.status !== 'shipped' && b.status === 'shipped') return -1;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        sortedOrders.forEach(order => {
            const card = document.createElement('div');
            const statusClass = order.status || 'pending';
            card.className = `order-card order-card-${statusClass}`;
            card.dataset.orderId = order.id;
            card.style.cursor = 'pointer';

            // Add click to open lightbox (but not on action buttons)
            card.addEventListener('click', function (e) {
                if (!e.target.closest('.order-actions')) {
                    openOrderLightbox(order.id);
                }
            });

            // Parse items
            let itemsHtml = '';
            if (order.items && Array.isArray(order.items)) {
                itemsHtml = order.items.map(item =>
                    `${item.product_name} (${item.size}) x${item.quantity}`
                ).join('<br>');
            }

            // Status label
            const statusLabel = {
                'pending': 'Pendente',
                'confirmed': 'Confirmada',
                'shipped': 'Entregue'
            }[statusClass] || 'Pendente';

            // Format date (Brazil timezone UTC-3)
            const orderDate = new Date(order.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Sao_Paulo'
            });

            // Format price
            const totalPrice = parseFloat(order.total_price || 0).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            });

            // Disable buttons if shipped
            const isShipped = statusClass === 'shipped';

            card.innerHTML = `
                <div class="order-header">
                    <span class="order-id">#${order.id.substring(0, 8).toUpperCase()}</span>
                    <span class="order-status ${statusClass}">${statusLabel}</span>
                </div>
                <div class="order-body">
                    <div class="order-customer">
                        <div class="order-customer-row">
                            <i class="fa-solid fa-user"></i>
                            <strong>${order.nome_completo || 'N/A'}</strong>
                        </div>
                        <div class="order-customer-row">
                            <i class="fa-solid fa-phone"></i>
                            <span>${order.telefone || 'N/A'}</span>
                        </div>
                        <div class="order-customer-row">
                            <i class="fa-solid fa-location-dot"></i>
                            <span>${order.cidade_estado || 'N/A'}</span>
                        </div>
                        <div class="order-customer-row">
                            <i class="fa-solid fa-truck"></i>
                            <span>${order.excursao_transportadora || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div class="order-items">
                        <div class="order-items-title">Itens do Pedido</div>
                        <div class="order-items-list">${itemsHtml || 'Nenhum item'}</div>
                    </div>

                    ${order.observacoes ? `
                        <div class="order-observations">
                            <strong>Obs:</strong> ${order.observacoes}
                        </div>
                    ` : ''}

                    ${order.cores_nao_desejadas ? `
                        <div class="order-observations">
                            <strong>Cores não desejadas:</strong> ${order.cores_nao_desejadas}
                        </div>
                    ` : ''}

                    <div class="order-total">
                        <span class="order-total-pieces">${order.total_items || 0} peças</span>
                        <span class="order-total-price">${totalPrice}</span>
                    </div>
                </div>
                <div class="order-actions">
                    <button class="order-action-btn pending-btn ${statusClass === 'pending' ? 'active' : ''}" onclick="updateOrderStatus('${order.id}', 'pending')" ${isShipped ? 'disabled' : ''}>
                        <i class="fa-solid fa-clock"></i> Pendente
                    </button>
                    <button class="order-action-btn confirm-btn ${statusClass === 'confirmed' ? 'active' : ''}" onclick="updateOrderStatus('${order.id}', 'confirmed')" ${isShipped ? 'disabled' : ''}>
                        <i class="fa-solid fa-check"></i> Confirmada
                    </button>
                    <button class="order-action-btn ship-btn ${statusClass === 'shipped' ? 'active' : ''}" onclick="updateOrderStatus('${order.id}', 'shipped')" ${isShipped ? 'disabled' : ''}>
                        <i class="fa-solid fa-truck"></i> Entregue
                    </button>
                </div>
                <div class="order-date">
                    <i class="fa-regular fa-clock"></i> ${orderDate}
                </div>
            `;

            container.appendChild(card);
        });
    }

    // Combined filter function for all orders filters
    function applyAllOrderFilters() {
        const searchQuery = (document.getElementById('orders-search')?.value || '').toLowerCase().trim();
        const selectedMonth = document.getElementById('filter-month')?.value || '';
        const selectedYear = document.getElementById('filter-year')?.value || '';

        let filtered = [...currentOrders];

        // Filter by month
        if (selectedMonth) {
            filtered = filtered.filter(order => {
                const orderDate = new Date(order.created_at);
                return (orderDate.getMonth() + 1) === parseInt(selectedMonth);
            });
        }

        // Filter by year
        if (selectedYear) {
            filtered = filtered.filter(order => {
                const orderDate = new Date(order.created_at);
                return orderDate.getFullYear() === parseInt(selectedYear);
            });
        }

        // Filter by search (name or phone)
        if (searchQuery) {
            const queryDigitsOnly = searchQuery.replace(/\D/g, '');
            filtered = filtered.filter(order => {
                const name = (order.nome_completo || '').toLowerCase();
                const phone = (order.telefone || '');
                const phoneDigitsOnly = phone.replace(/\D/g, '');
                return name.includes(searchQuery) ||
                    (queryDigitsOnly.length > 0 && phoneDigitsOnly.includes(queryDigitsOnly));
            });
        }

        renderOrders(filtered);
    }

    // Populate year dropdown with available years
    function populateYearFilter() {
        const yearSelect = document.getElementById('filter-year');
        if (!yearSelect || currentOrders.length === 0) return;

        const years = new Set();
        currentOrders.forEach(order => {
            const year = new Date(order.created_at).getFullYear();
            years.add(year);
        });

        // Add current year if not present
        years.add(new Date().getFullYear());

        // Sort years descending
        const sortedYears = Array.from(years).sort((a, b) => b - a);

        // Clear existing options except first
        yearSelect.innerHTML = '<option value="">Todos os Anos</option>';
        sortedYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });
    }





    // Make updateOrderStatus global
    window.updateOrderStatus = async function (orderId, newStatus) {
        const btn = event.target.closest('button');
        if (btn) btn.disabled = true;

        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId);

            if (error) {
                alert('Erro ao atualizar status: ' + error.message);
            } else {
                // Refresh orders
                await fetchOrders();
            }
        } catch (err) {
            console.error('Update error:', err);
            alert('Erro ao atualizar status');
        }
    };

    // =========================================================
    // ORDER LIGHTBOX FUNCTIONS
    // =========================================================

    window.openOrderLightbox = function (orderId) {
        const order = currentOrders.find(o => o.id === orderId);
        if (!order) return;

        const lightbox = document.getElementById('order-lightbox');
        const body = document.getElementById('order-lightbox-body');

        // Status info
        const statusClass = order.status || 'pending';
        const statusLabel = {
            'pending': 'Pendente',
            'confirmed': 'Confirmada',
            'shipped': 'Entregue'
        }[statusClass] || 'Pendente';

        // Format date (Brazil timezone UTC-3)
        const orderDate = new Date(order.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo'
        });

        // Format price
        const totalPrice = parseFloat(order.total_price || 0).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });

        // Parse items
        let itemsHtml = '';
        if (order.items && Array.isArray(order.items)) {
            itemsHtml = order.items.map(item =>
                `<div class="lightbox-item-row">${item.product_name} (${item.size}) x${item.quantity}</div>`
            ).join('');
        }

        body.innerHTML = `
            <div class="lightbox-order-header ${statusClass}">
                <h2>${order.nome_completo || 'Cliente'}</h2>
                <div class="lightbox-order-id">Pedido #${order.id.substring(0, 8).toUpperCase()}</div>
                <span class="lightbox-order-status ${statusClass}">${statusLabel}</span>
            </div>
            <div class="lightbox-order-body">
                <div class="lightbox-section">
                    <div class="lightbox-section-title">Informações do Cliente</div>
                    <div class="lightbox-customer-info">
                        <div class="lightbox-info-item">
                            <i class="fa-solid fa-phone"></i>
                            <span>${order.telefone || 'N/A'}</span>
                        </div>
                        <div class="lightbox-info-item">
                            <i class="fa-solid fa-location-dot"></i>
                            <span>${order.cidade_estado || 'N/A'}</span>
                        </div>
                        <div class="lightbox-info-item">
                            <i class="fa-solid fa-truck"></i>
                            <span>${order.excursao_transportadora || 'N/A'}</span>
                        </div>
                        <div class="lightbox-info-item">
                            <i class="fa-solid fa-credit-card"></i>
                            <span>${order.forma_pagamento || 'PIX'}</span>
                        </div>
                    </div>
                </div>

                <div class="lightbox-section">
                    <div class="lightbox-section-title">Itens do Pedido</div>
                    <div class="lightbox-items-list">
                        ${itemsHtml || '<div class="lightbox-item-row">Nenhum item</div>'}
                    </div>
                </div>

                ${order.observacoes ? `
                    <div class="lightbox-section">
                        <div class="lightbox-section-title">Observações</div>
                        <div class="lightbox-observations">${order.observacoes}</div>
                    </div>
                ` : ''}

                ${order.cores_nao_desejadas ? `
                    <div class="lightbox-section">
                        <div class="lightbox-section-title">Cores Não Desejadas</div>
                        <div class="lightbox-observations">${order.cores_nao_desejadas}</div>
                    </div>
                ` : ''}

                <div class="lightbox-total">
                    <span>${order.total_items || 0} peças</span>
                    <span class="lightbox-total-price">${totalPrice}</span>
                </div>

                <div class="lightbox-order-date">
                    <i class="fa-regular fa-clock"></i> Pedido em ${orderDate}
                </div>
            </div>
        `;

        // Inject the 'Salvar PDF' button at the bottom
        body.innerHTML += `
            <button id="btn-print-order" class="btn-whatsapp" style="margin-top: 15px; width: 100%; justify-content: center; background: #3B82F6;">
                <i class="fa-solid fa-file-pdf"></i> Salvar PDF do Pedido
            </button>
        `;

        lightbox.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Attach PDF Generation Logic
        const printBtn = document.getElementById('btn-print-order');
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                // Build items rows
                let itemRows = '';
                if (order.items && Array.isArray(order.items)) {
                    order.items.forEach((item, idx) => {
                        itemRows += `
                            <tr style="border-bottom: 1px solid #e0e0e0;">
                                <td style="padding: 8px 10px; font-size: 13px; color: #333;">${idx + 1}</td>
                                <td style="padding: 8px 10px; font-size: 13px; color: #333;">${item.product_name}</td>
                                <td style="padding: 8px 10px; font-size: 13px; color: #333; text-align: center;">${item.size}</td>
                                <td style="padding: 8px 10px; font-size: 13px; color: #333; text-align: center;">${item.quantity}</td>
                            </tr>
                        `;
                    });
                }

                const invoiceHTML = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Pedido_${order.id.substring(0, 8).toUpperCase()}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { font-family: 'Outfit', Arial, sans-serif; background: #fff; color: #222; padding: 30px; }
                        .invoice { max-width: 700px; margin: 0 auto; }
                        .header { text-align: center; border-bottom: 3px solid #D4A853; padding-bottom: 20px; margin-bottom: 20px; }
                        .header h1 { font-size: 28px; color: #1a1a1a; font-weight: 700; }
                        .header p { font-size: 14px; color: #666; margin-top: 5px; }
                        .header .date { font-size: 12px; color: #888; }
                        .status { margin-bottom: 20px; }
                        .status span { display: inline-block; padding: 5px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
                        .customer-box { margin-bottom: 20px; padding: 15px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; }
                        .customer-box h3 { font-size: 14px; color: #D4A853; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
                        .customer-box table { width: 100%; border-collapse: collapse; }
                        .customer-box td { padding: 4px 0; font-size: 13px; color: #555; }
                        .items-section h3 { font-size: 14px; color: #D4A853; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
                        .items-table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; margin-bottom: 20px; }
                        .items-table th { padding: 10px; font-size: 12px; color: #555; text-align: left; border-bottom: 2px solid #d1d5db; background: #f3f4f6; }
                        .items-table th.center { text-align: center; }
                        .items-table td { padding: 8px 10px; font-size: 13px; color: #333; }
                        .items-table td.center { text-align: center; }
                        .items-table tr { border-bottom: 1px solid #e0e0e0; }
                        .notes { margin-bottom: 15px; padding: 12px; border-left: 4px solid #f59e0b; background: #fffbeb; border-radius: 4px; }
                        .notes strong { font-size: 12px; color: #92400e; }
                        .notes p { margin-top: 5px; font-size: 13px; color: #78350f; }
                        .colors-block { margin-bottom: 15px; padding: 12px; border-left: 4px solid #ef4444; background: #fef2f2; border-radius: 4px; }
                        .colors-block strong { font-size: 12px; color: #991b1b; }
                        .colors-block p { margin-top: 5px; font-size: 13px; color: #7f1d1d; }
                        .total-bar { display: flex; justify-content: space-between; align-items: center; padding: 15px; background: #1a1a1a; border-radius: 8px; margin-top: 20px; }
                        .total-bar .pieces { font-size: 15px; color: #ccc; }
                        .total-bar .price { font-size: 22px; font-weight: 700; color: #D4A853; }
                        .footer { text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb; }
                        .footer p { font-size: 11px; color: #999; margin-top: 5px; }
                        @media print {
                            body { padding: 15px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            .no-print { display: none !important; }
                        }
                    </style>
                </head>
                <body>
                    <div class="invoice">
                        <div class="header">
                            <h1>JFJ CONFECÇÕES</h1>
                            <p>Pedido #${order.id.substring(0, 8).toUpperCase()}</p>
                            <p class="date">Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>

                        <div class="status">
                            <span style="background: ${statusClass === 'confirmed' ? '#d1fae5' : statusClass === 'shipped' ? '#dbeafe' : '#fef3c7'}; color: ${statusClass === 'confirmed' ? '#065f46' : statusClass === 'shipped' ? '#1e40af' : '#92400e'};">
                                ${statusLabel}
                            </span>
                        </div>

                        <div class="customer-box">
                            <h3>Informações do Cliente</h3>
                            <table>
                                <tr>
                                    <td style="width:50%"><strong>Nome:</strong> ${order.nome_completo || 'N/A'}</td>
                                    <td><strong>Telefone:</strong> ${order.telefone || 'N/A'}</td>
                                </tr>
                                <tr>
                                    <td><strong>Cidade:</strong> ${order.cidade_estado || 'N/A'}</td>
                                    <td><strong>Pagamento:</strong> ${order.forma_pagamento || 'PIX'}</td>
                                </tr>
                                <tr>
                                    <td colspan="2"><strong>Transporte:</strong> ${order.excursao_transportadora || 'N/A'}</td>
                                </tr>
                            </table>
                        </div>

                        <div class="items-section">
                            <h3>Itens do Pedido</h3>
                            <table class="items-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Produto</th>
                                        <th class="center">Tamanho</th>
                                        <th class="center">Qtd</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemRows}
                                </tbody>
                            </table>
                        </div>

                        ${order.observacoes ? `
                        <div class="notes">
                            <strong>Observações:</strong>
                            <p>${order.observacoes}</p>
                        </div>
                        ` : ''}

                        ${order.cores_nao_desejadas ? `
                        <div class="colors-block">
                            <strong>Cores Não Desejadas:</strong>
                            <p>${order.cores_nao_desejadas}</p>
                        </div>
                        ` : ''}

                        <div class="total-bar">
                            <span class="pieces">${order.total_items || 0} peças</span>
                            <span class="price">${totalPrice}</span>
                        </div>

                        <div class="footer">
                            <p>Pedido realizado em ${orderDate}</p>
                            <p>JFJ Confecções — Documento gerado automaticamente</p>
                        </div>
                    </div>

                    <div class="no-print" style="text-align: center; margin-top: 30px;">
                        <button onclick="window.print()" style="padding: 12px 30px; background: #3B82F6; color: #fff; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; font-family: 'Outfit', sans-serif;">
                            <span>🖨️ Imprimir / Salvar PDF</span>
                        </button>
                    </div>
                </body>
                </html>
                `;

                const printWindow = window.open('', '_blank');
                printWindow.document.write(invoiceHTML);
                printWindow.document.close();
            });
        }
    };

    window.closeOrderLightbox = function () {
        const lightbox = document.getElementById('order-lightbox');
        lightbox.classList.add('hidden');
        document.body.style.overflow = '';
    };

    // Close lightbox on overlay click
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('order-lightbox-overlay')) {
            closeOrderLightbox();
        }
    });

    // Close lightbox on Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeOrderLightbox();
        }
    });

    // =========================================================
    // VIDEO MANAGEMENT FUNCTIONS
    // =========================================================

    let videoUploadTarget = null; // product ID being uploaded to

    function renderVideoGrid(searchTerm = '') {
        const grid = document.getElementById('admin-video-grid');
        const emptyState = document.getElementById('videos-empty');
        if (!grid) return;

        let products = currentProducts || [];

        // Filter by search term
        if (searchTerm.trim()) {
            const query = searchTerm.trim().toLowerCase();
            products = products.filter(p => p.name && p.name.toLowerCase().includes(query));
        }

        if (products.length === 0) {
            grid.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');
        grid.innerHTML = '';

        const priceFormat = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

        products.forEach(p => {
            const card = document.createElement('div');
            card.className = 'video-admin-card';

            const thumb = p.images && p.images.length ? p.images[0] : 'https://via.placeholder.com/100?text=Foto';
            const hasVideo = !!p.video_url;

            card.innerHTML = `
                <div class="card-header">
                    <img src="${thumb}" alt="${p.name}">
                    <span class="card-title">${p.name}</span>
                    <span class="card-price">${priceFormat.format(p.price || 0)}</span>
                </div>
                <div class="video-admin-preview">
                    ${hasVideo
                    ? `<video src="${p.video_url}" controls muted preload="metadata"></video>`
                    : `<div class="no-video"><i class="fa-solid fa-film" style="font-size:2rem;color:#ccc;display:block;margin-bottom:8px;"></i>Nenhum vídeo</div>`
                }
                </div>
                <div class="video-admin-actions">
                    <button class="btn-upload-video" onclick="window.triggerVideoUpload('${p.id}')">
                        <i class="fa-solid fa-upload"></i> ${hasVideo ? 'Trocar' : 'Upload'}
                    </button>
                    ${hasVideo ? `
                        <button class="btn-remove-video" onclick="window.removeProductVideo('${p.id}')">
                            <i class="fa-solid fa-trash"></i> Remover
                        </button>
                    ` : ''}
                </div>
            `;

            grid.appendChild(card);
        });
    }

    // Trigger file input for video upload
    window.triggerVideoUpload = function (productId) {
        videoUploadTarget = productId;
        const input = document.getElementById('video-file-input');
        if (input) {
            input.value = '';
            input.click();
        }
    };

    // Handle video file selection
    const videoFileInput = document.getElementById('video-file-input');
    if (videoFileInput) {
        videoFileInput.addEventListener('change', async (e) => {
            if (!e.target.files || e.target.files.length === 0 || !videoUploadTarget) return;

            const file = e.target.files[0];

            // Validate file size (max 250MB)
            if (file.size > 250 * 1024 * 1024) {
                alert('O vídeo deve ter no máximo 250MB.');
                return;
            }

            // Validate duration (max 60s) — check after metadata loads
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.src = URL.createObjectURL(file);

            video.onloadedmetadata = async () => {
                URL.revokeObjectURL(video.src);

                if (video.duration > 65) { // 65s with small tolerance
                    alert('O vídeo deve ter no máximo 60 segundos.');
                    return;
                }

                // Upload to Supabase Storage
                setLoading(true);
                try {
                    const fileName = `video-${videoUploadTarget}-${Date.now()}.${file.name.split('.').pop()}`;
                    const { data, error } = await supabase.storage
                        .from('Videos')
                        .upload(fileName, file);

                    if (error) throw error;

                    const { data: { publicUrl } } = supabase.storage.from('Videos').getPublicUrl(fileName);

                    // Update product record with video URL
                    const { error: dbError } = await supabase
                        .from('store_items')
                        .update({ video_url: publicUrl })
                        .eq('id', videoUploadTarget);

                    if (dbError) throw dbError;

                    // Refresh data
                    await fetchProducts();
                    renderVideoGrid();
                    alert('Vídeo salvo com sucesso!');

                } catch (err) {
                    console.error('Video upload error:', err);
                    alert('Erro ao fazer upload: ' + (err.message || err));
                } finally {
                    setLoading(false);
                    videoUploadTarget = null;
                }
            };
        });
    }

    // Remove video from product
    window.removeProductVideo = async function (productId) {
        if (!confirm('Remover o vídeo deste produto?')) return;

        setLoading(true);
        try {
            // Find product to get video URL
            const product = currentProducts.find(p => p.id === productId);
            if (product && product.video_url) {
                // Try to delete from storage (extract filename from URL)
                try {
                    const urlParts = product.video_url.split('/');
                    const fileName = urlParts[urlParts.length - 1];
                    await supabase.storage.from('Videos').remove([fileName]);
                } catch (e) {
                    console.warn('Could not delete video file from storage:', e);
                }
            }

            // Clear video_url on product
            const { error } = await supabase
                .from('store_items')
                .update({ video_url: null })
                .eq('id', productId);

            if (error) throw error;

            await fetchProducts();
            renderVideoGrid();
            alert('Vídeo removido!');

        } catch (err) {
            console.error('Video remove error:', err);
            alert('Erro ao remover: ' + (err.message || err));
        } finally {
            setLoading(false);
        }
    };

    // =========================================================
    // EMERGENCY STORE TOGGLE (Schedule-Aware)
    // =========================================================

    let isEmergencyClosed = false;

    function getScheduleStatus() {
        const now = new Date();
        const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const day = brTime.getDay(); // 0=Sun, 1=Mon, ... 5=Fri, 6=Sat
        const currentMinutes = brTime.getHours() * 60 + brTime.getMinutes();

        // Open: Mon(1) 00:00 → Fri(5) 10:00 (600min)
        if (day >= 1 && day <= 4) return true;  // Mon-Thu: open
        if (day === 5 && currentMinutes <= 600) return true; // Fri before 10AM: open
        return false; // Fri after 10AM, Sat, Sun: closed
    }

    async function setupEmergencyToggle() {
        const btn = document.getElementById('btn-emergency');
        if (!btn) return;

        // Fetch current emergency state
        try {
            const { data, error } = await supabase
                .from('store_settings')
                .select('emergency_closed')
                .limit(1)
                .single();

            if (!error && data) {
                isEmergencyClosed = data.emergency_closed === true;
            }
        } catch (err) {
            console.warn('Could not fetch store settings:', err);
        }

        updateEmergencyButtonUI();
        btn.onclick = toggleEmergency;

        // Auto-refresh every 60s to keep in sync with schedule
        setInterval(updateEmergencyButtonUI, 60000);
    }

    async function toggleEmergency() {
        const isOpenBySchedule = getScheduleStatus();

        // If closed by schedule, don't allow toggling
        if (!isOpenBySchedule) {
            alert('A loja já está fechada pelo horário programado (Sexta após 10h até Domingo). Não é necessário fechar manualmente.');
            return;
        }

        const btn = document.getElementById('btn-emergency');
        const newState = !isEmergencyClosed;

        const confirmMsg = newState
            ? 'Tem certeza que deseja FECHAR a loja manualmente? Nenhum cliente poderá fazer pedidos até você reabrir.'
            : 'Deseja REABRIR a loja para pedidos?';

        if (!confirm(confirmMsg)) return;

        btn.disabled = true;

        try {
            const { error } = await supabase
                .from('store_settings')
                .update({ emergency_closed: newState, updated_at: new Date().toISOString() })
                .not('id', 'is', null);

            if (error) {
                alert('Erro ao atualizar: ' + error.message);
            } else {
                isEmergencyClosed = newState;
                updateEmergencyButtonUI();
                alert(newState ? 'Loja FECHADA manualmente.' : 'Loja REABERTA para pedidos.');
            }
        } catch (err) {
            console.error('Emergency toggle error:', err);
            alert('Erro ao atualizar status da loja.');
        } finally {
            btn.disabled = false;
        }
    }

    function updateEmergencyButtonUI() {
        const btn = document.getElementById('btn-emergency');
        const label = document.getElementById('emergency-label');
        if (!btn) return;

        const isOpenBySchedule = getScheduleStatus();

        if (!isOpenBySchedule) {
            // Closed by schedule — show as closed, no manual action needed
            btn.classList.add('emergency-active');
            btn.classList.add('schedule-closed');
            if (label) label.textContent = 'Loja Fechada (Horário)';
        } else if (isEmergencyClosed) {
            // Manually closed during open hours
            btn.classList.add('emergency-active');
            btn.classList.remove('schedule-closed');
            if (label) label.textContent = 'Loja Fechada (Manual)';
        } else {
            // Open normally
            btn.classList.remove('emergency-active');
            btn.classList.remove('schedule-closed');
            if (label) label.textContent = 'Loja Aberta';
        }
    }

})();
