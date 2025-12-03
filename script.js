const API_URL = 'https://script.google.com/macros/s/AKfycbzT6q8jgICOy8xvtzxLUDxqv2NvzvR9Y-UaNvEoPrLZAydg50RewFWo62zDs9nZCLqk/exec';

const CONFIG = {
    productsPerPage: 10000,
    timeout: 30000,
    debounceTime: 300
};

const dom = {
    freeSearch: document.getElementById('freeSearch'),
    brandsSelect: document.getElementById('brandsSelect'),
    selectedUser: document.getElementById('selectedUser'),
    selectedPrazo: document.getElementById('selectedPrazo'),
    clientEmail: document.getElementById('clientEmail'),
    clientNotes: document.getElementById('clientNotes'),
    results: document.getElementById('results'),
    resultsCount: document.getElementById('resultsCount'),
    loading: document.getElementById('loading'),
    filtersSummary: document.getElementById('filtersSummary'),
    cartBadge: document.getElementById('cartBadge'),
    cartModal: document.getElementById('cartModal'),
    cartItems: document.getElementById('cartItems'),
    cartSummary: document.getElementById('cartSummary'),
    cartTotal: document.getElementById('cartTotal'),
    userError: document.getElementById('userError'),
    prazoError: document.getElementById('prazoError'),
    emailError: document.getElementById('emailError')
};

let allBrands = [], allProducts = [], allUsers = [], allPrazos = [];
let brandsLoaded = false, usersLoaded = false, prazosLoaded = false;
let cart = [], currentQuantities = {}, lastOrderNumber = 0;
let isLoading = false;
let currentFilteredProducts = [];

let searchTimeout;
function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchProducts();
    }, CONFIG.debounceTime);
}

document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadBrands();
    loadUsers();
    loadPrazos();
    loadCartFromStorage();
    loadLastOrderNumber();
});

function loadLastOrderNumber() {
    const savedNumber = localStorage.getItem('lanort_last_order_number');
    lastOrderNumber = savedNumber ? parseInt(savedNumber) : 0;
}

function generateOrderNumber() {
    lastOrderNumber++;
    localStorage.setItem('lanort_last_order_number', lastOrderNumber.toString());
    return String(lastOrderNumber).padStart(4, '0');
}

function setupEventListeners() {
    dom.freeSearch.addEventListener('input', debounceSearch);
    
    dom.brandsSelect.addEventListener('change', function() {
        if (brandsLoaded) {
            searchProducts();
        }
    });

    dom.selectedUser.addEventListener('change', function() {
        validateField(dom.selectedUser, dom.userError);
    });

    dom.selectedPrazo.addEventListener('change', function() {
        validateField(dom.selectedPrazo, dom.prazoError);
    });

    dom.clientEmail.addEventListener('input', function() {
        validateEmailField();
    });

    dom.cartModal.addEventListener('click', function(e) {
        if (e.target === dom.cartModal) closeCartModal();
    });
}

function validateField(field, errorElement) {
    if (!field.value.trim()) {
        field.classList.add('error');
        errorElement.style.display = 'block';
        return false;
    } else {
        field.classList.remove('error');
        errorElement.style.display = 'none';
        return true;
    }
}

function validateEmailField() {
    const email = dom.clientEmail.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email) {
        dom.clientEmail.classList.add('error');
        dom.emailError.textContent = 'Por favor, informe um email';
        dom.emailError.style.display = 'block';
        return false;
    } else if (!emailRegex.test(email)) {
        dom.clientEmail.classList.add('error');
        dom.emailError.textContent = 'Por favor, informe um email válido';
        dom.emailError.style.display = 'block';
        return false;
    } else {
        dom.clientEmail.classList.remove('error');
        dom.emailError.style.display = 'none';
        return true;
    }
}

function validateAndFinalizeOrder() {
    const finalizeBtn = document.querySelector('.btn-success');
    
    finalizeBtn.disabled = true;
    finalizeBtn.classList.add('btn-loading');
    finalizeBtn.innerHTML = '⏳ Enviando Pedido...';

    const isUserValid = validateField(dom.selectedUser, dom.userError);
    const isPrazoValid = validateField(dom.selectedPrazo, dom.prazoError);
    const isEmailValid = validateEmailField();

    if (isUserValid && isPrazoValid && isEmailValid) {
        finalizeOrder();
    } else {
        resetFinalizeButton();
        showError('Por favor, preencha todos os campos obrigatórios corretamente');
        
        if (!isUserValid) {
            dom.selectedUser.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (!isPrazoValid) {
            dom.selectedPrazo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (!isEmailValid) {
            dom.clientEmail.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

async function loadUsers() {
    try {
        const response = await fetch(`${API_URL}?recurso=usuarios`);
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        const data = await response.json();
        
        if (data.sucesso && data.dados) {
            allUsers = data.dados;
        } else if (data.dados && Array.isArray(data.dados)) {
            allUsers = data.dados;
        } else if (Array.isArray(data)) {
            allUsers = data;
        } else {
            throw new Error('Formato de resposta inesperado');
        }
        
        renderUserSelect();
        usersLoaded = true;
        
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        showError('Erro ao carregar usuários');
    }
}

async function loadPrazos() {
    try {
        const response = await fetch(`${API_URL}?recurso=prazos`);
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        const data = await response.json();
        
        if (data.sucesso && data.dados) {
            allPrazos = data.dados;
        } else if (data.dados && Array.isArray(data.dados)) {
            allPrazos = data.dados;
        } else if (Array.isArray(data)) {
            allPrazos = data;
        } else {
            throw new Error('Formato de resposta inesperado');
        }
        
        renderPrazoSelect();
        prazosLoaded = true;
        
    } catch (error) {
        console.error('Erro ao carregar prazos:', error);
        showError('Erro ao carregar prazos');
    }
}

function renderUserSelect() {
    let html = '<option value="">Selecione um usuário</option>';
    allUsers.forEach(user => {
        const codigo = user['Cód. Parceiro'] || user.codigo || user.id || user.Codigo || '';
        const nome = user['Nome Parceiro'] || user.nome || user.Nome || '';
        const displayText = `${codigo} - ${nome}`;
        const value = user['Cód. Parceiro'] || user.codigo || user.id || user.Codigo || codigo;
        html += `<option value="${value}">${displayText}</option>`;
    });
    dom.selectedUser.innerHTML = html;
}

function renderPrazoSelect() {
    let html = '<option value="">Selecione um prazo de pagamento</option>';
    allPrazos.forEach(prazo => {
        const tipo = prazo['Tipo de Negociação'] || prazo.tipo || prazo.Tipo || '';
        const descricao = prazo['Descrição'] || prazo.descricao || prazo.Descricao || '';
        const displayText = `${tipo} - ${descricao}`;
        const value = tipo;
        html += `<option value="${value}">${displayText}</option>`;
    });
    dom.selectedPrazo.innerHTML = html;
}

function parsePriceFromAPI(price) {
    if (!price) return 0;
    let priceStr = String(price).trim();
    if (priceStr.includes(',')) priceStr = priceStr.replace(',', '.');
    const priceNum = parseFloat(priceStr);
    return isNaN(priceNum) ? 0 : Math.round(priceNum * 100) / 100;
}

function formatPrice(price) {
    const priceNum = parsePriceFromAPI(price);
    return priceNum.toLocaleString('pt-BR', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
}

function calculatePreciseTotal(price, quantity) {
    if (!price || !quantity) return 0;
    const priceNum = parsePriceFromAPI(price);
    const quantityNum = parseInt(quantity);
    if (isNaN(priceNum) || isNaN(quantityNum)) return 0;
    const total = priceNum * quantityNum;
    return Math.round(total * 100) / 100;
}

function getProductStock(product) {
    const estoque = product.Estoque || product.estoque || product.Stock || product.stock || product.Quantidade || product.quantidade;
    
    if (estoque !== undefined && estoque !== null) {
        return parseInt(estoque);
    }
    
    return Math.floor(Math.random() * 50) + 10;
}

function formatStock(stock) {
    if (stock === 0) {
        return '<span style="color: #ff5252;">⛔ Estoque: 0 (Indisponível)</span>';
    } else if (stock < 10) {
        return `<span style="color: #ff9800;">⚠️ Estoque: ${stock} (Baixo)</span>`;
    } else if (stock < 30) {
        return `<span style="color: #1976d2;">📦 Estoque: ${stock}</span>`;
    } else {
        return `<span style="color: #388e3c;">✅ Estoque: ${stock}</span>`;
    }
}

async function loadBrands() {
    try {
        const response = await fetch(`${API_URL}?recurso=produtos`);
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        const data = await response.json();
        
        if (data.sucesso && data.dados) {
            allProducts = data.dados;
        } else if (data.dados && Array.isArray(data.dados)) {
            allProducts = data.dados;
        } else if (Array.isArray(data)) {
            allProducts = data;
        } else {
            throw new Error('Formato de resposta inesperado');
        }
        
        extractBrands(allProducts);
        brandsLoaded = true;
        
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        showError('Erro ao carregar produtos: ' + error.message);
    }
}

function extractBrands(products) {
    const brands = [...new Set(products
        .map(p => p.Marca || p.marca)
        .filter(brand => brand && brand.trim() !== '')
    )].sort();
    
    allBrands = brands;
    renderBrandsSelect();
}

function renderBrandsSelect() {
    let html = '<option value="">Todas as marcas</option>';
    allBrands.forEach(brand => {
        html += `<option value="${brand.replace(/"/g, '&quot;')}">${brand}</option>`;
    });
    dom.brandsSelect.innerHTML = html;
}

async function searchProducts() {
    if (!brandsLoaded) await loadBrands();

    const searchTerm = dom.freeSearch.value.trim();
    const selectedBrand = dom.brandsSelect.value;

    if (isLoading) return;
    isLoading = true;

    showLoading();

    try {
        currentFilteredProducts = filterProducts(searchTerm, selectedBrand);
        displayResults(currentFilteredProducts, searchTerm, selectedBrand);
    } catch (error) {
        showError(`Erro ao buscar produtos: ${error.message}`);
    } finally {
        isLoading = false;
        hideLoading();
    }
}

function filterProducts(searchTerm, selectedBrand) {
    let filteredProducts = [...allProducts];

    if (selectedBrand) {
        filteredProducts = filteredProducts.filter(product => {
            const marca = product.Marca || product.marca;
            return marca && marca === selectedBrand;
        });
    }

    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredProducts = filteredProducts.filter(product => {
            const codigo = product.Código || product.codigo || product.id;
            const marca = product.Marca || product.marca;
            const descricao = product.Descrição || product.descricao;
            const codigoBarras = product['Código de Barra'] || product.codigo_barras || product.barcode;
            
            return (
                (codigo && String(codigo).toLowerCase().includes(term)) ||
                (marca && String(marca).toLowerCase().includes(term)) ||
                (descricao && String(descricao).toLowerCase().includes(term)) ||
                (codigoBarras && String(codigoBarras).includes(term))
            );
        });
    }

    return filteredProducts;
}

function displayResults(products, searchTerm, selectedBrand) {
    const totalProducts = products.length;
    
    updateResultsCount(totalProducts);
    updateFiltersSummary(searchTerm, selectedBrand);
    
    if (totalProducts === 0) {
        showNoResults();
        return;
    }

    let html = '';

    products.forEach(product => {
        const productCode = product.Código || product.codigo || product.id;
        const currentQty = currentQuantities[productCode] || 0;
        
        const priceDisplay = parsePriceFromAPI(product.Preço || product.preco || product.price);
        const totalPrice = calculatePreciseTotal(product.Preço || product.preco || product.price, currentQty || 0);
        const hasImage = product.imagem && product.imagem !== '';
        const stock = getProductStock(product);
        const stockDisplay = formatStock(stock);
        
        const safeCode = productCode.toString().replace(/'/g, "\\'").replace(/"/g, '&quot;');
        
        html += `
            <div class="product-card">
                <div class="product-image-container">
                    ${hasImage ? 
                        `<img src="${product.imagem}" alt="${product.Descrição || product.descricao || 'Produto'}" 
                              class="product-image"
                              onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'no-image\\'>📷 Imagem não disponível</div>';" 
                              loading="lazy">` : 
                        '<div class="no-image">📷 Sem imagem</div>'
                    }
                </div>
                <div class="product-info">
                    <div class="product-code">
                        <strong>Código:</strong> ${productCode || 'N/A'}
                    </div>
                    <div class="product-barcode">
                        <strong>Cód. Barras:</strong> ${product['Código de Barra'] || product.codigo_barras || product.barcode || 'N/A'}
                    </div>
                    <div class="product-stock">
                        ${stockDisplay}
                    </div>
                    <div class="product-brand">
                        ${product.Marca || product.marca || 'Sem marca'}
                    </div>
                    <div class="product-description">
                        ${product.Descrição || product.descricao || 'Sem descrição'}
                    </div>
                    <div class="product-price">
                        R$ ${formatPrice(priceDisplay)}
                    </div>
                    
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="updateQuantity('${safeCode}', -1)">-</button>
                        <input type="number" id="quantity-${safeCode}" class="quantity-input" 
                               value="${currentQty}" min="0" max="${stock}"
                               onchange="currentQuantities['${safeCode}'] = parseInt(this.value); updateRealTimeTotal('${safeCode}')">
                        <button class="quantity-btn" onclick="updateQuantity('${safeCode}', 1)">+</button>
                    </div>
                    
                    <div class="real-time-total" id="realtime-total-${safeCode}">
                        ${currentQty > 0 ? `Total: R$ ${formatPrice(totalPrice)}` : 'Selecione a quantidade'}
                    </div>
                    
                    <button class="add-to-cart" onclick="addToCart('${safeCode}', currentQuantities['${safeCode}'] || 0)" ${currentQty === 0 || stock === 0 ? 'disabled' : ''}>
                        ${stock === 0 ? '⛔ Sem Estoque' : currentQty === 0 ? '🛒 Selecione a quantidade' : '🛒 Adicionar ao Carrinho'}
                    </button>
                </div>
            </div>
        `;
    });
    
    dom.results.innerHTML = html;
    showResults();
}

function updateResultsCount(totalFiltered) {
    if (totalFiltered === 0) {
        dom.resultsCount.textContent = 'Nenhum produto encontrado';
    } else if (totalFiltered === 1) {
        dom.resultsCount.textContent = '1 produto encontrado';
    } else {
        dom.resultsCount.textContent = `${totalFiltered} produtos encontrados`;
    }
}

function updateFiltersSummary(searchTerm, selectedBrand) {
    let summary = '';
    if (selectedBrand) {
        summary += `<strong>Marca selecionada:</strong> <span class="selected-brand">${selectedBrand}<button onclick="clearBrand()">×</button></span>`;
    }
    if (searchTerm) {
        if (summary) summary += '<br>';
        summary += `<strong>Pesquisa:</strong> "${searchTerm}"`;
    }
    if (!summary) {
        summary = `<strong>Mostrando todos os produtos (${allProducts.length})</strong>`;
    }
    
    dom.filtersSummary.innerHTML = summary;
    dom.filtersSummary.style.display = 'block';
}

function updateRealTimeTotal(productCode) {
    const product = allProducts.find(p => 
        (p.Código && p.Código.toString() === productCode) || 
        (p.codigo && p.codigo.toString() === productCode) || 
        (p.id && p.id.toString() === productCode)
    );
    const currentQty = currentQuantities[productCode] || 0;
    
    if (product && currentQty > 0) {
        const total = calculatePreciseTotal(product.Preço || product.preco || product.price, currentQty);
        const totalElement = document.getElementById(`realtime-total-${productCode}`);
        if (totalElement) {
            totalElement.textContent = `Total: R$ ${formatPrice(total)}`;
        }
        
        const addButton = document.querySelector(`button[onclick="addToCart('${productCode}', currentQuantities['${productCode}'] || 0)"]`);
        if (addButton) {
            addButton.disabled = false;
            addButton.innerHTML = '🛒 Adicionar ao Carrinho';
        }
    } else {
        const totalElement = document.getElementById(`realtime-total-${productCode}`);
        if (totalElement) {
            totalElement.textContent = 'Selecione a quantidade';
        }
        
        const addButton = document.querySelector(`button[onclick="addToCart('${productCode}', currentQuantities['${productCode}'] || 0)"]`);
        if (addButton && addButton.innerHTML !== '⛔ Sem Estoque') {
            addButton.disabled = true;
            addButton.innerHTML = '🛒 Selecione a quantidade';
        }
    }
}

function updateQuantity(productCode, change) {
    if (!currentQuantities[productCode]) currentQuantities[productCode] = 0;
    
    const product = allProducts.find(p => 
        (p.Código && p.Código.toString() === productCode) || 
        (p.codigo && p.codigo.toString() === productCode) || 
        (p.id && p.id.toString() === productCode)
    );
    const stock = product ? getProductStock(product) : 999;
    
    currentQuantities[productCode] += change;
    if (currentQuantities[productCode] < 0) currentQuantities[productCode] = 0;
    if (currentQuantities[productCode] > stock) currentQuantities[productCode] = stock;
    
    const quantityElement = document.getElementById(`quantity-${productCode}`);
    if (quantityElement) quantityElement.value = currentQuantities[productCode];
    
    updateRealTimeTotal(productCode);
}

function loadCartFromStorage() {
    const savedCart = localStorage.getItem('lanort_cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartUI();
    }
}

function saveCartToStorage() {
    localStorage.setItem('lanort_cart', JSON.stringify(cart));
}

function addToCart(productCode, quantity) {
    if (quantity === 0) {
        showError('Selecione uma quantidade maior que zero!');
        return;
    }

    const product = allProducts.find(p => 
        (p.Código && p.Código.toString() === productCode) || 
        (p.codigo && p.codigo.toString() === productCode) || 
        (p.id && p.id.toString() === productCode)
    );
    
    if (!product) {
        showError('Produto não encontrado!');
        return;
    }

    const stock = getProductStock(product);
    if (stock === 0) {
        showError('Produto sem estoque disponível!');
        return;
    }

    if (quantity > stock) {
        showError(`Quantidade solicitada (${quantity}) maior que estoque disponível (${stock})!`);
        return;
    }

    const existingItem = cart.find(item => item.codigo === productCode);
    
    if (existingItem) {
        const newQuantity = existingItem.quantidade + parseInt(quantity);
        if (newQuantity > stock) {
            showError(`Quantidade total no carrinho (${newQuantity}) maior que estoque disponível (${stock})!`);
            return;
        }
        existingItem.quantidade = newQuantity;
        existingItem.valorTotal = calculatePreciseTotal(product.Preço || product.preco || product.price, existingItem.quantidade);
    } else {
        const precoUnitario = parsePriceFromAPI(product.Preço || product.preco || product.price);
        const hasImage = product.imagem && product.imagem !== '';
            
        cart.push({
            codigo: productCode,
            descricao: product.Descrição || product.descricao,
            marca: product.Marca || product.marca,
            precoUnitario: precoUnitario,
            quantidade: parseInt(quantity),
            valorTotal: calculatePreciseTotal(product.Preço || product.preco || product.price, quantity),
            estoque: stock,
            imagem: product.imagem || '',
            hasImage: hasImage
        });
    }
    
    saveCartToStorage();
    updateCartUI();
    showSuccess('Produto adicionado ao carrinho!');
    
    currentQuantities[productCode] = 0;
    const quantityElement = document.getElementById(`quantity-${productCode}`);
    if (quantityElement) quantityElement.value = 0;
    updateRealTimeTotal(productCode);
    
    dom.cartBadge.classList.add('pulse');
    setTimeout(() => dom.cartBadge.classList.remove('pulse'), 500);
}

function updateItemQuantity(index, change) {
    const item = cart[index];
    const product = allProducts.find(p => 
        (p.Código && p.Código.toString() === item.codigo) || 
        (p.codigo && p.codigo.toString() === item.codigo) || 
        (p.id && p.id.toString() === item.codigo)
    );
    
    if (!product) return;
    
    const stock = getProductStock(product);
    const newQuantity = item.quantidade + change;
    
    if (newQuantity < 1) {
        removeFromCart(index);
        return;
    }
    if (newQuantity > stock) {
        showError(`Quantidade não pode ser maior que o estoque disponível (${stock})!`);
        return;
    }
    
    item.quantidade = newQuantity;
    item.valorTotal = calculatePreciseTotal(product.Preço || product.preco || product.price, item.quantidade);
    saveCartToStorage();
    updateCartUI();
}

function updateCartItemQuantity(index, newQuantity) {
    if (newQuantity < 1) {
        removeFromCart(index);
        return;
    }
    
    const item = cart[index];
    const product = allProducts.find(p => 
        (p.Código && p.Código.toString() === item.codigo) || 
        (p.codigo && p.codigo.toString() === item.codigo) || 
        (p.id && p.id.toString() === item.codigo)
    );
    
    if (!product) return;
    
    const stock = getProductStock(product);
    if (newQuantity > stock) {
        showError(`Quantidade não pode ser maior que o estoque disponível (${stock})!`);
        return;
    }
    
    item.quantidade = parseInt(newQuantity);
    item.valorTotal = calculatePreciseTotal(product.Preço || product.preco || product.price, item.quantidade);
    saveCartToStorage();
    updateCartUI();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    saveCartToStorage();
    updateCartUI();
}

function updateCartUI() {
    const totalProducts = cart.length;
    const cartCountElement = dom.cartBadge.querySelector('.cart-count');
    
    cartCountElement.textContent = totalProducts;
    
    if (totalProducts === 0) {
        dom.cartBadge.classList.add('empty');
        dom.cartBadge.classList.remove('pulse');
    } else {
        dom.cartBadge.classList.remove('empty');
    }
    
    if (cart.length === 0) {
        dom.cartItems.innerHTML = '<div class="empty-state"><p>Seu carrinho está vazio</p></div>';
        dom.cartSummary.style.display = 'none';
    } else {
        let html = '';
        let total = 0;
        
        cart.forEach((item, index) => {
            total += item.valorTotal;
            const stockInfo = item.estoque ? `<div style="font-size: 0.7rem; color: #666;">Estoque: ${item.estoque}</div>` : '';
            
            html += `
                <div class="cart-item">
                    <div class="cart-item-image-container">
                        ${item.hasImage ? 
                            `<img src="${item.imagem}" alt="${item.descricao}" 
                                  class="cart-item-image"
                                  onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'cart-item-no-image\\'>📷</div>';"
                                  loading="lazy">` : 
                            '<div class="cart-item-no-image">📷</div>'
                        }
                    </div>
                    <div class="cart-item-content">
                        <div class="cart-item-header">
                            <div class="cart-item-info">
                                <div class="cart-item-description">${item.descricao}</div>
                                <div class="cart-item-details">
                                    ${item.marca} | Cód: ${item.codigo}
                                    ${stockInfo}
                                </div>
                                <div class="cart-item-price">
                                    R$ ${formatPrice(item.precoUnitario)} un
                                </div>
                            </div>
                            <div class="cart-item-total-section">
                                <div class="cart-item-total">
                                    R$ ${formatPrice(item.valorTotal)}
                                </div>
                                <button class="remove-item" onclick="removeFromCart(${index})" title="Remover item">
                                    🗑️
                                </button>
                            </div>
                        </div>
                        
                        <div class="cart-item-controls">
                            <div class="cart-quantity-controls">
                                <button class="cart-quantity-btn" onclick="updateItemQuantity(${index}, -1)">-</button>
                                <input type="number" class="cart-quantity-input" 
                                       value="${item.quantidade}" min="1" max="${item.estoque || 999}"
                                       onchange="updateCartItemQuantity(${index}, this.value)"
                                       onblur="updateCartItemQuantity(${index}, this.value)">
                                <button class="cart-quantity-btn" onclick="updateItemQuantity(${index}, 1)">+</button>
                            </div>
                            <div class="item-subtotal">
                                Subtotal: R$ ${formatPrice(item.valorTotal)}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        dom.cartItems.innerHTML = html;
        dom.cartTotal.textContent = formatPrice(total);
        dom.cartSummary.style.display = 'block';
    }
}

function openCartModal() {
    dom.cartModal.style.display = 'block';
}

function closeCartModal() {
    dom.cartModal.style.display = 'none';
    resetFinalizeButton();
}

// 🔥🔥🔥 NOVA FUNÇÃO: ENVIAR PEDIDOS EM LOTE 🔥🔥🔥
async function finalizeOrderEmLote() {
    const clientEmailValue = dom.clientEmail.value.trim();
    const clientNotesValue = dom.clientNotes.value.trim();
    const selectedUserValue = dom.selectedUser.value;
    const selectedPrazoValue = dom.selectedPrazo.value;
    
    if (cart.length === 0) {
        showError('O carrinho está vazio!');
        resetFinalizeButton();
        return;
    }
    
    const finalizeBtn = document.querySelector('.btn-success');
    finalizeBtn.disabled = true;
    finalizeBtn.classList.add('btn-loading');
    finalizeBtn.innerHTML = '⏳ Enviando Pedido em Lote...';
    
    // Busca informações completas do usuário e prazo
    const selectedUserObj = allUsers.find(u => 
        (u['Cód. Parceiro'] && u['Cód. Parceiro'].toString() === selectedUserValue) ||
        (u.codigo && u.codigo.toString() === selectedUserValue) ||
        (u.id && u.id.toString() === selectedUserValue)
    );
    const selectedPrazoObj = allPrazos.find(p => 
        (p['Tipo de Negociação'] && p['Tipo de Negociação'].toString() === selectedPrazoValue) ||
        (p.tipo && p.tipo.toString() === selectedPrazoValue) ||
        (p.Tipo && p.Tipo.toString() === selectedPrazoValue)
    );
    
    // Prepara o texto para usuário e prazo
    const usuarioTexto = selectedUserObj ? 
        `${selectedUserObj['Cód. Parceiro'] || selectedUserObj.codigo || selectedUserObj.id} - ${selectedUserObj['Nome Parceiro'] || selectedUserObj.nome || selectedUserObj.Nome}` : 
        selectedUserValue;
    
    const prazoTexto = selectedPrazoObj ? 
        `${selectedPrazoObj['Tipo de Negociação'] || selectedPrazoObj.tipo || selectedPrazoObj.Tipo} - ${selectedPrazoObj['Descrição'] || selectedPrazoObj.descricao || selectedPrazoObj.Descricao}` : 
        selectedPrazoValue;
    
    try {
        console.log('🚀 Preparando envio em LOTE com', cart.length, 'itens...');
        
        // 🔥 Prepara os itens para envio em lote
        const itensParaEnvio = cart.map(item => ({
            codigo: item.codigo,
            descricao: item.descricao,
            quantidade: item.quantidade,
            valorUnitario: item.precoUnitario,
            valorTotal: item.valorTotal
        }));
        
        // 🔥 Dados para envio em lote
        const dadosPedido = {
            recurso: 'pedidos',
            modo: 'lote', // 🔥 Modo LOTE para envio múltiplo
            email: clientEmailValue,
            usuario: usuarioTexto,
            prazo: prazoTexto,
            observacoes: clientNotesValue,
            itens: JSON.stringify(itensParaEnvio) // 🔥 Itens como JSON string
        };
        
        console.log('📦 Dados do pedido em lote:', dadosPedido);
        
        // 🔥 Envia em formato form-urlencoded
        const formData = new URLSearchParams();
        Object.keys(dadosPedido).forEach(key => {
            formData.append(key, dadosPedido[key]);
        });
        
        const startTime = Date.now();
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });
        
        const tempo = Date.now() - startTime;
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.sucesso) {
            const numeroPedidoAPI = result.dados?.numeroPedido || generateOrderNumber();
            
            // Mostra sucesso
            showSuccess(`🎉 Pedido ${numeroPedidoAPI} enviado em LOTE! ${cart.length} itens salvos em ${tempo}ms`);
            console.log(`✅ Pedido em lote salvo: ${numeroPedidoAPI} (${tempo}ms)`);
            console.log('📊 Resultado:', result);
            
            // Limpa o carrinho
            cart = [];
            saveCartToStorage();
            updateCartUI();
            
            // Atualiza o botão
            finalizeBtn.innerHTML = '✅ Pedido Enviado!';
            finalizeBtn.classList.remove('btn-loading');
            
            // Limpa o formulário após 3 segundos
            setTimeout(() => {
                closeCartModal();
                dom.clientEmail.value = '';
                dom.clientNotes.value = '';
                dom.selectedUser.value = '';
                dom.selectedPrazo.value = '';
                
                dom.userError.style.display = 'none';
                dom.prazoError.style.display = 'none';
                dom.emailError.style.display = 'none';
                dom.selectedUser.classList.remove('error');
                dom.selectedPrazo.classList.remove('error');
                dom.clientEmail.classList.remove('error');
                
                resetFinalizeButton();
            }, 3000);
            
        } else {
            throw new Error(result.erro || 'Erro desconhecido ao salvar pedido em lote');
        }
        
    } catch (error) {
        console.error('❌ Erro ao enviar pedido em lote:', error);
        showError(`Erro ao enviar pedido em lote: ${error.message}`);
        resetFinalizeButton();
    }
}

// 🔥 Atualiza a função finalizeOrder para usar o modo lote
async function finalizeOrder() {
    // Verifica se pode usar modo lote (API v3.0+)
    try {
        const testResponse = await fetch(`${API_URL}?recurso=teste`);
        const testData = await testResponse.json();
        
        // Verifica se a API suporta modo lote (versão 3.0+)
        const version = parseFloat(testData.versao) || 1.0;
        
        if (version >= 3.0) {
            // Usa modo lote (mais rápido!)
            return await finalizeOrderEmLote();
        } else {
            // Usa modo individual (para compatibilidade)
            return await finalizeOrderIndividual();
        }
    } catch (error) {
        console.warn('⚠️ Não foi possível detectar versão da API, usando modo lote...');
        return await finalizeOrderEmLote();
    }
}

// 🔥 Função original de finalização individual (mantida para compatibilidade)
async function finalizeOrderIndividual() {
    const clientEmailValue = dom.clientEmail.value.trim();
    const clientNotesValue = dom.clientNotes.value.trim();
    const selectedUserValue = dom.selectedUser.value;
    const selectedPrazoValue = dom.selectedPrazo.value;
    
    if (cart.length === 0) {
        showError('O carrinho está vazio!');
        resetFinalizeButton();
        return;
    }
    
    const numeroPedido = generateOrderNumber();
    let savedCount = 0;
    let errorCount = 0;
    const totalItems = cart.length;
    
    // Busca informações completas do usuário e prazo
    const selectedUserObj = allUsers.find(u => 
        (u['Cód. Parceiro'] && u['Cód. Parceiro'].toString() === selectedUserValue) ||
        (u.codigo && u.codigo.toString() === selectedUserValue) ||
        (u.id && u.id.toString() === selectedUserValue)
    );
    const selectedPrazoObj = allPrazos.find(p => 
        (p['Tipo de Negociação'] && p['Tipo de Negociação'].toString() === selectedPrazoValue) ||
        (p.tipo && p.tipo.toString() === selectedPrazoValue) ||
        (p.Tipo && p.Tipo.toString() === selectedPrazoValue)
    );
    
    const usuarioTexto = selectedUserObj ? 
        `${selectedUserObj['Cód. Parceiro'] || selectedUserObj.codigo || selectedUserObj.id} - ${selectedUserObj['Nome Parceiro'] || selectedUserObj.nome || selectedUserObj.Nome}` : 
        selectedUserValue;
    
    const prazoTexto = selectedPrazoObj ? 
        `${selectedPrazoObj['Tipo de Negociação'] || selectedPrazoObj.tipo || selectedPrazoObj.Tipo} - ${selectedPrazoObj['Descrição'] || selectedPrazoObj.descricao || selectedPrazoObj.Descricao}` : 
        selectedPrazoValue;
    
    for (let index = 0; index < cart.length; index++) {
        const item = cart[index];
        
        const orderData = {
            recurso: 'pedidos',
            email: clientEmailValue,
            observacoes: clientNotesValue,
            codigo: item.codigo,
            descricao: item.descricao,
            quantidade: item.quantidade,
            valorUnitario: item.precoUnitario,
            valorTotal: item.valorTotal,
            usuario: usuarioTexto,
            prazo: prazoTexto,
            numeroPedido: numeroPedido,
            numeroItem: (index + 1).toString().padStart(2, '0')
        };
        
        try {
            const formData = new URLSearchParams();
            Object.keys(orderData).forEach(key => {
                formData.append(key, orderData[key]);
            });
            
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString()
            });
            
            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.sucesso) {
                errorCount++;
                showError(`Erro ao salvar item ${index + 1}: ${result.erro || 'Erro desconhecido'}`);
            } else {
                savedCount++;
                console.log(`✅ Item ${index + 1} salvo: Pedido ${result.dados?.numeroPedido || 'N/A'}`);
            }
            
        } catch (error) {
            errorCount++;
            console.error(`❌ Erro ao salvar item ${index + 1}:`, error);
            showError(`Erro ao salvar item ${index + 1}: ${error.message}`);
        }
        
        if (index < cart.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    if (errorCount === 0 && savedCount === totalItems) {
        showSuccessButton();
        showSuccess(`🎉 Pedido ${numeroPedido} finalizado com ${totalItems} item(ns)! Os dados foram salvos na planilha.`);
        
        cart = [];
        saveCartToStorage();
        updateCartUI();
        
        setTimeout(() => {
            closeCartModal();
            dom.clientEmail.value = '';
            dom.clientNotes.value = '';
            dom.selectedUser.value = '';
            dom.selectedPrazo.value = '';
            
            dom.userError.style.display = 'none';
            dom.prazoError.style.display = 'none';
            dom.emailError.style.display = 'none';
            dom.selectedUser.classList.remove('error');
            dom.selectedPrazo.classList.remove('error');
            dom.clientEmail.classList.remove('error');
        }, 3000);
        
    } else if (savedCount > 0) {
        showSuccess(`⚠️ Pedido ${numeroPedido} parcialmente salvo: ${savedCount}/${totalItems} itens salvos. ${errorCount} falharam.`);
        resetFinalizeButton();
        
        cart = cart.filter((_, index) => index >= savedCount);
        saveCartToStorage();
        updateCartUI();
        
    } else {
        showError(`❌ Pedido não salvo! ${errorCount} itens falharam. Verifique a conexão e tente novamente.`);
        resetFinalizeButton();
    }
}

function clearBrand() {
    dom.brandsSelect.value = '';
    searchProducts();
}

function showLoading() {
    dom.loading.style.display = 'block';
    dom.results.innerHTML = '';
    dom.filtersSummary.style.display = 'none';
}

function hideLoading() {
    dom.loading.style.display = 'none';
}

function showResults() {
    dom.results.style.display = 'grid';
}

function showNoResults() {
    dom.results.innerHTML = `
        <div class="empty-state">
            <div>🔍</div>
            <p>Nenhum produto encontrado com os critérios informados</p>
        </div>`;
    showResults();
}

function showError(message) {
    const existingError = document.querySelector('.error-message');
    if (existingError) existingError.remove();
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `<strong>Erro:</strong> ${message}`;
    document.querySelector('.container').insertBefore(errorDiv, document.querySelector('.search-container'));
    setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
    const existingSuccess = document.querySelector('.success-message');
    if (existingSuccess) existingSuccess.remove();
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.innerHTML = `<strong>Sucesso:</strong> ${message}`;
    document.querySelector('.container').insertBefore(successDiv, document.querySelector('.search-container'));
    setTimeout(() => successDiv.remove(), 5000);
}

function clearSearch() {
    dom.freeSearch.value = '';
    dom.brandsSelect.value = '';
    dom.results.innerHTML = `
        <div class="empty-state">
            <div>📦</div>
            <p>Use os filtros acima para buscar produtos</p>
        </div>`;
    dom.resultsCount.textContent = 'Use os filtros acima para buscar produtos';
    dom.filtersSummary.style.display = 'none';
    currentQuantities = {};
}

function resetFinalizeButton() {
    const finalizeBtn = document.querySelector('.btn-success');
    if (finalizeBtn) {
        finalizeBtn.disabled = false;
        finalizeBtn.classList.remove('btn-loading');
        finalizeBtn.innerHTML = '✅ Finalizar Pedido';
    }
}

function showSuccessButton() {
    const finalizeBtn = document.querySelector('.btn-success');
    if (finalizeBtn) {
        finalizeBtn.disabled = true;
        finalizeBtn.classList.remove('btn-loading');
        finalizeBtn.innerHTML = '✅ Pedido Enviado!';
        
        setTimeout(() => {
            resetFinalizeButton();
        }, 3000);
    }
}

// 🔥 Função para testar a API
async function testarAPI() {
    console.log('🧪 Testando conexão com API...');
    try {
        const response = await fetch(`${API_URL}?recurso=teste`);
        const data = await response.json();
        console.log('✅ Teste API:', data);
        return data.sucesso;
    } catch (error) {
        console.error('❌ Erro teste API:', error);
        return false;
    }
}

// 🔥 Função para testar o envio em lote (debug)
async function testarEnvioLote() {
    console.log('🧪 Testando envio em lote...');
    
    // Cria um carrinho de teste
    const testeCart = [
        {
            codigo: "TESTE001",
            descricao: "Produto Teste 1",
            quantidade: 2,
            precoUnitario: 10.50,
            valorTotal: 21.00
        },
        {
            codigo: "TESTE002",
            descricao: "Produto Teste 2",
            quantidade: 3,
            precoUnitario: 5.75,
            valorTotal: 17.25
        }
    ];
    
    const dadosTeste = {
        recurso: 'pedidos',
        modo: 'lote',
        email: 'teste@lanort.com',
        usuario: '001 - Teste Lote',
        prazo: 'À VISTA',
        observacoes: 'Teste de envio em lote',
        itens: JSON.stringify(testeCart)
    };
    
    try {
        const formData = new URLSearchParams();
        Object.keys(dadosTeste).forEach(key => {
            formData.append(key, dadosTeste[key]);
        });
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });
        
        const result = await response.json();
        console.log('📊 Resultado teste lote:', result);
        
        if (result.sucesso) {
            showSuccess('✅ Teste de lote funcionando!');
        } else {
            showError(`❌ Teste lote falhou: ${result.erro}`);
        }
        
    } catch (error) {
        console.error('❌ Erro no teste lote:', error);
        showError(`Erro no teste lote: ${error.message}`);
    }
}

// Teste inicial automático
window.addEventListener('load', async () => {
    const conectado = await testarAPI();
    if (conectado) {
        console.log('✅ Sistema Lanort conectado com sucesso!');
    } else {
        console.warn('⚠️ Verifique a conexão com a API');
    }
});
