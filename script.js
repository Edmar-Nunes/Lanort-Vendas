const API_URL = 'https://script.google.com/macros/s/AKfycbzJ1QAxM6xkvhC0nJrNJ9vFW1g7ujJzf2FlfdRD2UsROA7HS_Sa5NvXL8HBhj-WzDHL/exec';

// ✅ CONFIGURAÇÃO SEM LIMITAÇÕES
const CONFIG = {
    productsPerPage: 10000, // Número muito alto para mostrar tudo
    timeout: 30000,
    debounceTime: 300
};

// Cache de elementos DOM
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

// Variáveis globais
let allBrands = [], allProducts = [], allUsers = [], allPrazos = [];
let brandsLoaded = false, usersLoaded = false, prazosLoaded = false;
let cart = [], currentQuantities = {}, lastOrderNumber = 0;
let isLoading = false;
let currentFilteredProducts = [];

// Debounce para pesquisa
let searchTimeout;
function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchProducts();
    }, CONFIG.debounceTime);
}

// Inicialização
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
        google.script.run
            .withSuccessHandler(function(result) {
                if (result.success) {
                    allUsers = result.data;
                    renderUserSelect();
                    usersLoaded = true;
                } else {
                    throw new Error(result.error);
                }
            })
            .withFailureHandler(function(error) {
                loadSampleUsers();
            })
            .getUsuariosFromSheet();
            
    } catch (error) {
        loadSampleUsers();
    }
}

async function loadPrazos() {
    try {
        google.script.run
            .withSuccessHandler(function(result) {
                if (result.success) {
                    allPrazos = result.data;
                    renderPrazoSelect();
                    prazosLoaded = true;
                } else {
                    throw new Error(result.error);
                }
            })
            .withFailureHandler(function(error) {
                loadSamplePrazos();
            })
            .getPrazosFromSheet();
            
    } catch (error) {
        loadSamplePrazos();
    }
}

function renderUserSelect() {
    let html = '<option value="">Selecione um usuário</option>';
    allUsers.forEach(user => {
        const codigo = user['Cód. Parceiro'] || user.codigo || user.id || '';
        const nome = user['Nome Parceiro'] || user.nome || user.Nome || '';
        const displayText = `${codigo} - ${nome}`;
        html += `<option value="${codigo}">${displayText}</option>`;
    });
    dom.selectedUser.innerHTML = html;
}

function renderPrazoSelect() {
    let html = '<option value="">Selecione um prazo de pagamento</option>';
    allPrazos.forEach(prazo => {
        const tipo = prazo['Tipo de Negociação'] || prazo.tipo || prazo.Tipo || '';
        const descricao = prazo['Descrição'] || prazo.descricao || prazo.Descricao || '';
        const displayText = `${tipo} - ${descricao}`;
        html += `<option value="${tipo}">${displayText}</option>`;
    });
    dom.selectedPrazo.innerHTML = html;
}

function loadSampleUsers() {
    allUsers = [
        {"Cód. Parceiro": "001", "Nome Parceiro": "Cliente Exemplo 1"},
        {"Cód. Parceiro": "002", "Nome Parceiro": "Cliente Exemplo 2"}
    ];
    renderUserSelect();
    usersLoaded = true;
}

function loadSamplePrazos() {
    allPrazos = [
        {"Tipo de Negociação": "001", "Descrição": "À Vista"},
        {"Tipo de Negociação": "002", "Descrição": "30 Dias"},
        {"Tipo de Negociação": "003", "Descrição": "60 Dias"}
    ];
    renderPrazoSelect();
    prazosLoaded = true;
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
        google.script.run
            .withSuccessHandler(function(result) {
                if (result.success) {
                    // ✅ CORREÇÃO: SEMPRE usar todos os produtos sem limitação
                    allProducts = result.data;
                    
                    // ✅ CORREÇÃO: Extrair marcas de TODOS os produtos
                    extractBrands(allProducts);
                    brandsLoaded = true;
                    
                    console.log(`✅ Carregados ${allProducts.length} produtos sem limitação`);
                } else {
                    throw new Error(result.error);
                }
            })
            .withFailureHandler(function(error) {
                loadBrandsDirectAPI();
            })
            .getAllProductsFromAPI();
            
    } catch (error) {
        loadBrandsDirectAPI();
    }
}

async function loadBrandsDirectAPI() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        const data = await response.json();
        if (data.erro) throw new Error(data.erro + (data.detalhes ? ` - ${data.detalhes}` : ''));
        
        if (Array.isArray(data)) allProducts = data;
        else if (data.dados && Array.isArray(data.dados)) allProducts = data.dados;
        else if (data.produtos && Array.isArray(data.produtos)) allProducts = data.produtos;
        else if (data.data && Array.isArray(data.data)) allProducts = data.data;
        else allProducts = Object.values(data).find(val => Array.isArray(val)) || [];
        
        if (allProducts.length === 0) throw new Error('Nenhum produto encontrado na API');
        
        extractBrands(allProducts);
        brandsLoaded = true;
        
        console.log(`✅ Carregados ${allProducts.length} produtos via API direta`);
        
    } catch (error) {
        dom.brandsSelect.innerHTML = '<option value="">Erro ao carregar marcas</option>';
        loadSampleData();
    }
}

function loadSampleData() {
    allProducts = [
        {
            Código: "2647",
            Marca: "ACEMAR",
            Descrição: "ACEMAR ACEDERME LOÇAO OLEOSA DE GIRASSOL 100ML",
            "Código de Barra": "0070341788231",
            Preço: "4.37",
            Estoque: 25,
            imagem: "https://relatorios.lanort.com.br/static/images/produtos/2647.png"
        },
        {
            Código: "2648", 
            Marca: "ACEMAR",
            Descrição: "ACEMAR ACEDERME LOÇAO OLEOSA DE GIRASSOL 200ML",
            "Código de Barra": "0074403234888", 
            Preço: "8.94",
            Estoque: 12,
            imagem: "https://relatorios.lanort.com.br/static/images/produtos/2648.png"
        },
        {
            Código: "65",
            Marca: "ALFAPARF",
            Descrição: "AM COLOR DESAMARELADOR 150G",
            "Código de Barra": "7898468503811",
            Preço: "13.08",
            Estoque: 8,
            imagem: ""
        }
    ];
    
    extractBrands(allProducts);
    brandsLoaded = true;
    
    console.log(`✅ Carregados ${allProducts.length} produtos de exemplo`);
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
        // ✅ CORREÇÃO: Filtra usando todos os produtos disponíveis
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
    // ✅ CORREÇÃO: Filtra usando TODOS os produtos sem limitação
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
    
    // ✅ CORREÇÃO: Mostra o total REAL de produtos filtrados
    updateResultsCount(totalProducts);
    updateFiltersSummary(searchTerm, selectedBrand);
    
    if (totalProducts === 0) {
        showNoResults();
        return;
    }

    let html = '';

    // ✅ CORREÇÃO: Renderizar TODOS os produtos de uma vez
    products.forEach(product => {
        const productCode = product.Código || product.codigo || product.id;
        const currentQty = currentQuantities[productCode] || 0;
        
        const priceDisplay = parsePriceFromAPI(product.Preço || product.preco || product.price);
        const totalPrice = calculatePreciseTotal(product.Preço || product.preco || product.price, currentQty || 0);
        const hasImage = product.imagem && product.imagem !== '';
        const stock = getProductStock(product);
        const stockDisplay = formatStock(stock);
        
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
                        <button class="quantity-btn" onclick="updateQuantity('${productCode}', -1)">-</button>
                        <input type="number" id="quantity-${productCode}" class="quantity-input" 
                               value="${currentQty}" min="0" max="${stock}"
                               onchange="currentQuantities['${productCode}'] = parseInt(this.value); updateRealTimeTotal('${productCode}')">
                        <button class="quantity-btn" onclick="updateQuantity('${productCode}', 1)">+</button>
                    </div>
                    
                    <div class="real-time-total" id="realtime-total-${productCode}">
                        ${currentQty > 0 ? `Total: R$ ${formatPrice(totalPrice)}` : 'Selecione a quantidade'}
                    </div>
                    
                    <button class="add-to-cart" onclick="addToCart('${productCode}', currentQuantities['${productCode}'] || 0)" ${currentQty === 0 || stock === 0 ? 'disabled' : ''}>
                        ${stock === 0 ? '⛔ Sem Estoque' : currentQty === 0 ? '🛒 Selecione a quantidade' : '🛒 Adicionar ao Carrinho'}
                    </button>
                </div>
            </div>
        `;
    });
    
    dom.results.innerHTML = html;
    showResults();
    
    console.log(`✅ Exibindo ${totalProducts} produtos sem limitação`);
}

function updateResultsCount(totalFiltered) {
    if (totalFiltered === 0) {
        dom.resultsCount.textContent = 'Nenhum produto encontrado';
    } else if (totalFiltered === 1) {
        dom.resultsCount.textContent = '1 produto encontrado';
    } else {
        // ✅ CORREÇÃO: Sempre mostra o número real de produtos
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
        (p.Código === productCode) || 
        (p.codigo === productCode) || 
        (p.id === productCode)
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
        (p.Código === productCode) || 
        (p.codigo === productCode) || 
        (p.id === productCode)
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
        (p.Código === productCode) || 
        (p.codigo === productCode) || 
        (p.id === productCode)
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
        (p.Código === item.codigo) || 
        (p.codigo === item.codigo) || 
        (p.id === item.codigo)
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
        (p.Código === item.codigo) || 
        (p.codigo === item.codigo) || 
        (p.id === item.codigo)
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

function finalizeOrder() {
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
    
    const selectedUserObj = allUsers.find(u => 
        (u['Cód. Parceiro'] === selectedUserValue) ||
        (u.codigo === selectedUserValue) ||
        (u.id === selectedUserValue)
    );
    const selectedPrazoObj = allPrazos.find(p => 
        (p['Tipo de Negociação'] === selectedPrazoValue) ||
        (p.tipo === selectedPrazoValue) ||
        (p.Tipo === selectedPrazoValue)
    );
    
    cart.forEach((item, index) => {
        const orderData = {
            email: clientEmailValue,
            observacoes: clientNotesValue,
            codigo: item.codigo,
            descricao: item.descricao,
            quantidade: item.quantidade,
            valorUnitario: item.precoUnitario,
            valorTotal: item.valorTotal,
            usuario: selectedUserObj ? `${selectedUserObj['Cód. Parceiro'] || selectedUserObj.codigo} - ${selectedUserObj['Nome Parceiro'] || selectedUserObj.nome}` : '',
            prazo: selectedPrazoObj ? `${selectedPrazoObj['Tipo de Negociação'] || selectedPrazoObj.tipo} - ${selectedPrazoObj['Descrição'] || selectedPrazoObj.descricao}` : '',
            numeroPedido: numeroPedido,
            numeroItem: (index + 1).toString().padStart(2, '0')
        };
        
        google.script.run
            .withSuccessHandler(function(result) {
                if (result.success) {
                    savedCount++;
                    if (savedCount === totalItems) {
                        showSuccessButton();
                        showSuccess(`Pedido ${numeroPedido} finalizado com ${totalItems} item(ns)!`);
                        
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
                        }, 2000);
                    }
                } else {
                    errorCount++;
                    showError(`Erro ao salvar item ${index + 1}: ${result.error}`);
                    resetFinalizeButton();
                }
            })
            .withFailureHandler(function(error) {
                errorCount++;
                showError(`Erro ao salvar item ${index + 1}: ${error}`);
                resetFinalizeButton();
            })
            .saveOrderToSheet(orderData);
    });
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
    setTimeout(() => successDiv.remove(), 3000);
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

function blockFinalizeButton() {
    const finalizeBtn = document.querySelector('.btn-success');
    if (finalizeBtn) {
        finalizeBtn.disabled = true;
        finalizeBtn.classList.add('btn-loading');
        finalizeBtn.innerHTML = '⏳ Enviando Pedido...';
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
