// --- DOM Element Getters ---
const get = (id) => document.getElementById(id);
const loginScreen = get('login-screen');
const verifyScreen = get('verify-screen');
const gameScreen = get('game-screen');
const mainLayout = get('main-layout');

// --- Toast Notifications ---
export function showToast(message, type = 'info') {
    const container = get('notification-container');
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('show'); }, 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => { if (container.contains(toast)) container.removeChild(toast); }, 500);
    }, 5000);
}

// --- Screen/View Management ---
export function showLoginScreen() {
    document.body.classList.add('logged-out');
    loginScreen.classList.remove('hidden');
    verifyScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    mainLayout.classList.remove('visible');
    mainLayout.style.display = 'none';
}

export function showVerifyScreen(email, message) {
    loginScreen.classList.add('hidden');
    verifyScreen.classList.remove('hidden');
    get('verify-email-display').textContent = email;
    get('code-input').value = '';
    get('code-message').textContent = message || '';
}

export function showDashboard() {
    document.body.classList.remove('logged-out');
    loginScreen.classList.add('hidden');
    verifyScreen.classList.add('hidden');
    mainLayout.classList.remove('visible');
    mainLayout.style.display = 'none';
    gameScreen.classList.remove('hidden');
}

export function showGameView() {
    gameScreen.classList.add('hidden');
    mainLayout.style.display = 'flex';
    mainLayout.classList.add('visible');
}

// --- Dashboard UI Updates ---
export function updateDashboardUI(player) {
    if (!player) return;
    get('player-username').textContent = player.username;
    get('player-coins').textContent = (player.draicorCoins || 0).toLocaleString();
    if (player.stats) {
        const hpText = `${player.stats.hpMax}/${player.stats.hpMax}`; // Always show max HP on dashboard
        get('hp-value').textContent = hpText;
        get('hp-bar').style.width = `100%`;
    }
}

// --- Modal Management ---
export function showModal(modalId) { get(modalId).classList.add('visible'); }
export function hideModal(modalId) { get(modalId).classList.remove('visible'); }

export function confirmAction(text, onConfirm, showQuantity = false) {
    const quantityContainer = get('quantity-selector-container');
    const quantityInput = get('quantity-input');
    get('confirm-text').textContent = text;

    quantityContainer.classList.toggle('hidden', !showQuantity);
    if (showQuantity) quantityInput.value = '1';

    showModal('confirm-modal');

    const yesBtn = get('confirm-yes-btn');
    const noBtn = get('confirm-no-btn');

    const yesHandler = () => {
        const quantity = showQuantity ? parseInt(quantityInput.value, 10) : 1;
        if (quantity > 0) onConfirm(quantity);
        cleanup();
    };
    const noHandler = () => cleanup();
    const cleanup = () => {
        hideModal('confirm-modal');
        yesBtn.removeEventListener('click', yesHandler);
        noBtn.removeEventListener('click', noHandler);
    };

    yesBtn.addEventListener('click', yesHandler, { once: true });
    noBtn.addEventListener('click', noHandler, { once: true });
}

// --- Specific Modal Content Renderers ---
export function renderStoreItems(items, player, onBuy) {
    const itemList = get('store-item-list');
    itemList.innerHTML = '';
    if (!items || items.length === 0) {
        itemList.innerHTML = '<li>Store is currently empty.</li>';
        return;
    }

    items.forEach(item => {
        const li = document.createElement('li');
        let isDisabled = false;
        let buttonText = `Buy (${item.price.toLocaleString()})`;
        
        if (item.id === 'STAR_01' && player.starsPurchasedTotal >= 200) {
            isDisabled = true; buttonText = 'Max Owned';
        } else if (player.draicorCoins < item.price) {
            isDisabled = true; buttonText = 'Insufficent Funds';
        } else if (item.type !== 'Potion' && item.type !== 'Bomb' && item.id !== 'STAR_01') {
            if (player.inventory && player.inventory.some(invItem => invItem.id === item.id)) {
                isDisabled = true; buttonText = 'Owned';
            }
        }
        
        li.innerHTML = `
            <div class="item-info"><p>${item.name}</p><small>${item.description}</small></div>
            <button class="buy-btn" ${isDisabled ? 'disabled' : ''}>${buttonText}</button>`;

        if (!isDisabled) {
            li.querySelector('.buy-btn').addEventListener('click', () => onBuy(item));
        }
        itemList.appendChild(li);
    });
}

export function renderInventory(player, onUpgrade) {
    const itemList = get('inventory-item-list');
    itemList.innerHTML = '';
    if (!player.inventory || player.inventory.length === 0) {
        itemList.innerHTML = '<li>Your inventory is empty.</li>';
        return;
    }
    const hasStars = player.inventory.some(item => item.id === 'STAR_01' && item.quantity > 0);

    player.inventory.forEach(item => {
        const li = document.createElement('li');
        let itemHtml = `<div class="item-info"><p style="color:${item.rarity.color}">${item.name} (x${item.quantity})</p>`;
        
        if (['Weapon', 'Shield', 'Helmet', 'Chest', 'Pants', 'Boots', 'Gloves', 'Belt'].includes(item.type)) {
            itemHtml += `<small>Stars: ${item.stars}</small></div>`;
            const upgradeCost = Math.floor(1000 * Math.pow(1.1, item.stars));
            const isDisabled = !hasStars || item.stars >= 25 || player.draicorCoins < upgradeCost;
            const buttonText = item.stars >= 25 ? 'Max' : (hasStars ? (player.draicorCoins < upgradeCost ? 'No Coins' : 'Upgrade') : 'Need Stars');
            itemHtml += `<button class="upgrade-btn" ${isDisabled ? 'disabled' : ''}>${buttonText}</button>`;
        } else {
            itemHtml += `</div>`;
        }
        li.innerHTML = itemHtml;
        
        const upgradeBtn = li.querySelector('.upgrade-btn');
        if (upgradeBtn && !upgradeBtn.disabled) {
            const upgradeCost = Math.floor(1000 * Math.pow(1.1, item.stars));
            upgradeBtn.addEventListener('click', () => onUpgrade(item, upgradeCost));
        }
        itemList.appendChild(li);
    });
}

export function renderEquipment(player) {
    if (!player || !player.equipped || !player.stats) return;
    get('stats-hp').textContent = player.stats.hpMax;
    get('stats-attack').textContent = player.stats.attack;
    get('stats-defense').textContent = player.stats.defense;

    for (const slot in player.equipped) {
        const element = get(`equipped-${slot}`);
        if (element) {
            const item = player.equipped[slot];
            element.innerHTML = item ? `<span style="color:${item.rarity.color}">${item.name}</span> (${item.stars}★)` : 'None';
        }
    }
}

export function renderItemSelection(player, slot, onSelect, onUnequip) {
    const selectionList = get('item-selection-list');
    get('item-selection-title').textContent = `Select for ${slot}`;
    selectionList.innerHTML = '';
    const validItems = player.inventory.filter(item => item.type && item.type.trim() === slot);

    if (validItems.length > 0) {
        validItems.forEach(item => {
            const li = document.createElement('li');
            li.style.cursor = 'pointer';
            li.innerHTML = `<div class="item-info"><p style="color:${item.rarity.color}">${item.name} (x${item.quantity})</p><small>Stars: ${item.stars}</small></div>`;
            li.onclick = () => onSelect(item.id, slot);
            selectionList.appendChild(li);
        });
    } else {
        selectionList.innerHTML = '<li>No items for this slot.</li>';
    }
    get('unequip-btn').onclick = () => onUnequip(slot);
}

export function renderPayments(data) {
    get('total-paid').textContent = `${data.totalPaid} USDT`;
    const tbody = get('payments-tbody');
    tbody.innerHTML = '';
    if (data.payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No payments made yet.</td></tr>';
    } else {
        data.payments.forEach(p => {
            const row = `<tr><td>${p.date}</td><td>${p.username}</td><td>${p.amount}</td><td>${p.transactionId}</td><td><a href="${p.link}" target="_blank" rel="noopener noreferrer">Verify</a></td></tr>`;
            tbody.innerHTML += row;
        });
    }
}

export function renderPagination(currentPage, totalPages, onPageClick) {
    const paginationContainer = get('pagination');
    paginationContainer.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.disabled = (i === currentPage);
        pageButton.onclick = () => onPageClick(i);
        paginationContainer.appendChild(pageButton);
    }
}

export function renderRanking(rankingData) {
    const tbody = get('ranking-tbody');
    tbody.innerHTML = '';
    rankingData.forEach(p => {
        const row = `<tr><td>${p.rank}</td><td>${p.username}</td><td>${p.score.toLocaleString()}</td></tr>`;
        tbody.innerHTML += row;
    });
}

export function renderUnifiedHistory(history) {
    const tbody = get('unified-history-tbody');
    tbody.innerHTML = '';
    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No transactions found.</td></tr>';
        return;
    }
    history.forEach(item => {
        let amountHtml = '';
        if (item.amountDTC) {
            const amount = parseFloat(item.amountDTC);
            const color = amount > 0 ? '#00ff00' : '#ff4136';
            amountHtml += `<span style="color:${color};">${amount.toLocaleString()} DTC</span><br/>`;
        }
        if (item.amountUSDT) {
            const amount = parseFloat(item.amountUSDT);
            const color = amount > 0 ? '#00ff00' : '#ff4136';
            amountHtml += `<span style="color:${color};">${amount.toFixed(6)} USDT</span>`;
        }
        const row = `<tr><td>${item.date}</td><td>${item.type}</td><td style="font-size: 0.8em;">${item.details}</td><td>${amountHtml}</td><td>${item.status}</td></tr>`;
        tbody.innerHTML += row;
    });
}

export function updateWalletUI(player, swapIsDtcToUsdt) {
    get('wallet-usdt-balance').textContent = (player.usdtBalance || 0).toFixed(6);
    get('wallet-message').textContent = '';
    const payBalanceEl = get('swap-pay-balance'), payCurrencyEl = get('swap-pay-currency'), receiveBalanceEl = get('swap-receive-balance'), receiveCurrencyEl = get('swap-receive-currency');
    if (swapIsDtcToUsdt) {
        payBalanceEl.textContent = `Balance: ${player.draicorCoins.toLocaleString()}`; payCurrencyEl.textContent = 'DraicorCoins';
        receiveBalanceEl.textContent = `Balance: ${(player.usdtBalance || 0).toFixed(6)}`; receiveCurrencyEl.textContent = 'USDT';
    } else {
        payBalanceEl.textContent = `Balance: ${(player.usdtBalance || 0).toFixed(6)}`; payCurrencyEl.textContent = 'USDT';
        receiveBalanceEl.textContent = `Balance: ${player.draicorCoins.toLocaleString()}`; receiveCurrencyEl.textContent = 'DraicorCoins';
    }
    get('swap-pay-input').value = ''; get('swap-receive-input').value = '';
}

export function showWalletView(viewToShow) {
    ['wallet-main-view', 'wallet-deposit-view', 'wallet-withdraw-view', 'wallet-swap-view', 'wallet-history-view'].forEach(view => {
        get(view).classList.add('hidden');
    });
    if (viewToShow) get(viewToShow).classList.remove('hidden');
}

export function showDepositMethod(method) {
    get('deposit-wallet-method').classList.toggle('hidden', method !== 'wallet');
    get('deposit-p2p-method').classList.toggle('hidden', method !== 'p2p');
}