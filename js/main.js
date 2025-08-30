import * as api from './api.js';
import * as ui from './ui.js';
import * as game from './game.js';

// --- Global State ---
let player = null;
let tempEmail = '';
let swapIsDtcToUsdt = true;
let currentDepositId = null;
const WITHDRAWAL_FEE = 0.30;
const SWAP_RATE = 1000000;

// --- DOM Element Getter ---
const get = (id) => document.getElementById(id);

// --- Initialization ---
function checkSession() {
    const sessionData = localStorage.getItem('draicor_session');
    if (sessionData) {
        try {
            player = JSON.parse(sessionData);
            ui.showDashboard();
            ui.updateDashboardUI(player);
            loadInventoryAndStats();
        } catch (e) {
            console.error("Failed to parse session data", e);
            localStorage.removeItem('draicor_session');
            ui.showLoginScreen();
        }
    } else {
        ui.showLoginScreen();
    }
}

// --- Event Handlers ---
async function handleRequestCode() {
    const emailInput = get('email-input');
    const messageDiv = get('message');
    const email = emailInput.value;
    const captcha = grecaptcha.getResponse();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        messageDiv.textContent = 'Please enter a valid email format.'; return;
    }
    if (!captcha) {
        messageDiv.textContent = 'Please complete the CAPTCHA.'; return;
    }

    tempEmail = email;
    get('request-code-btn').disabled = true;

    try {
        const result = await api.requestLoginCode(email, captcha, messageDiv);
        grecaptcha.reset();
        ui.showVerifyScreen(tempEmail, result.message);
    } catch (error) {
        ui.showToast(error.message, 'error');
        grecaptcha.reset();
    } finally {
        get('request-code-btn').disabled = false;
    }
}

async function handleVerifyCode() {
    const codeInput = get('code-input');
    const codeMessageDiv = get('code-message');
    const code = codeInput.value;

    if (!code || code.length < 6) {
        codeMessageDiv.textContent = 'Please enter the 6-character code.'; return;
    }

    get('verify-code-btn').disabled = true;
    try {
        player = await api.verifyLoginCode(tempEmail, code, codeMessageDiv);
        localStorage.setItem('draicor_session', JSON.stringify(player));
        ui.showDashboard();
        ui.updateDashboardUI(player);
    } catch (error) {
        ui.showToast(error.message, 'error');
        codeInput.value = '';
    } finally {
        get('verify-code-btn').disabled = false;
    }
}

async function loadInventoryAndStats() {
    try {
        const data = await api.getPlayerInventory(player.email);
        player = { ...player, ...data };
        localStorage.setItem('draicor_session', JSON.stringify(player));
        ui.updateDashboardUI(player);
    } catch (error) {
        ui.showToast(error.message, 'error');
    }
}

function handleLogout() {
    api.savePlayerData(player.email, { draicorCoins: player.draicorCoins, usdtBalance: player.usdtBalance });
    localStorage.removeItem('draicor_session');
    player = null;
    location.reload();
}

async function handleShowStore() {
    ui.showModal('store-modal');
    get('store-item-list').innerHTML = '<li>Loading items...</li>';
    try {
        const items = await api.getStoreItems(player.email);
        ui.renderStoreItems(items, player, (item) => {
            const isConsumable = ['Potion', 'Bomb', 'STAR_01'].includes(item.id) || item.id.startsWith('STAR');
            const confirmText = `Buy ${item.name} for ${item.price.toLocaleString()} DraicorCoins?`;
            ui.confirmAction(confirmText, async (quantity) => {
                try {
                    const result = await api.buyItem(player.email, item.id, quantity);
                    player.draicorCoins = result.newBalance;
                    player = { ...player, ...result.updatedInventory };
                    localStorage.setItem('draicor_session', JSON.stringify(player));
                    ui.updateDashboardUI(player);
                    await handleShowStore(); // Re-render the store to update button states
                    ui.showToast(`Purchased ${quantity} ${item.name}!`, 'success');
                } catch (buyError) {
                    ui.showToast(buyError.message, 'error');
                }
            }, isConsumable);
        });
    } catch (error) {
        ui.showToast(error.message, 'error');
        get('store-item-list').innerHTML = '<li>Error loading store.</li>';
    }
}

function handleShowInventory() {
    ui.renderInventory(player, (item, cost) => {
        ui.confirmAction(`Upgrade ${item.name} for ${cost.toLocaleString()} DraicorCoins and 1 Star?`, async () => {
            try {
                const result = await api.upgradeItem(player.email, item.id);
                player.draicorCoins = result.newBalance;
                player = { ...player, ...result.updatedInventory };
                localStorage.setItem('draicor_session', JSON.stringify(player));
                ui.updateDashboardUI(player);
                handleShowInventory(); // Re-render
                ui.showToast(`Successfully upgraded ${item.name}!`, 'success');
            } catch (upgradeError) {
                ui.showToast(upgradeError.message, 'error');
            }
        });
    });
    ui.showModal('inventory-modal');
}

function handleShowEquipment() {
    ui.renderEquipment(player);
    ui.showModal('equipment-modal');
}

async function handleEquip(itemID, slot) {
    try {
        player = await api.equipItem(player.email, itemID, slot);
        localStorage.setItem('draicor_session', JSON.stringify(player));
        ui.updateDashboardUI(player);
        ui.renderEquipment(player);
        ui.hideModal('item-selection-modal');
        const itemName = itemID ? player.inventory.find(i => i.id === itemID)?.name : null;
        ui.showToast(itemName ? `Equipped ${itemName}` : `Unequipped item from ${slot}`, 'info');
    } catch(error) {
        ui.showToast(error.message, 'error');
    }
}

async function handleShowPayments() {
    ui.showModal('payments-modal');
    await loadPaymentsPage(1);
}

async function loadPaymentsPage(page) {
    get('payments-tbody').innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
    try {
        const data = await api.getPublicPayments(page);
        ui.renderPayments(data);
        ui.renderPagination(data.currentPage, data.totalPages, loadPaymentsPage);
    } catch (error) {
        ui.showToast(error.message, 'error');
        get('payments-tbody').innerHTML = `<tr><td colspan="5">Error loading payments.</td></tr>`;
    }
}

async function handleShowRanking() {
    ui.showModal('ranking-modal');
    get('ranking-tbody').innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
    try {
        const rankingData = await api.getRanking();
        ui.renderRanking(rankingData);
    } catch(error) {
        ui.showToast(error.message, 'error');
        get('ranking-tbody').innerHTML = '<tr><td colspan="3">Error loading ranking.</td></tr>';
    }
}

// --- Wallet Handlers ---
function handleShowWallet() {
    ui.updateWalletUI(player, swapIsDtcToUsdt);
    ui.showWalletView('wallet-main-view');
    ui.showModal('wallet-modal');
}

async function handleWithdraw() {
    const amount = parseFloat(get('withdraw-amount-input').value);
    if (isNaN(amount) || amount <= 0) { ui.showToast("Please enter a valid amount.", "error"); return; }
    const netAmount = amount - WITHDRAWAL_FEE;
    const confirmText = `Request withdrawal of ${amount.toFixed(2)} USDT? A ${WITHDRAWAL_FEE.toFixed(2)} USDT fee will be applied. You will receive ${netAmount.toFixed(2)} USDT.`;
    
    ui.confirmAction(confirmText, async () => {
        try {
            const result = await api.requestWithdrawal(player.email, amount);
            player.usdtBalance = result.newUsdtBalance;
            localStorage.setItem('draicor_session', JSON.stringify(player));
            ui.updateDashboardUI(player);
            ui.updateWalletUI(player, swapIsDtcToUsdt);
            ui.showToast(result.message, 'success');
            setTimeout(() => ui.showWalletView('wallet-main-view'), 2000);
        } catch (error) { ui.showToast(error.message, 'error'); }
    });
}

async function handleExecuteSwap() {
    const amount = parseFloat(get('swap-pay-input').value);
    if (isNaN(amount) || amount <= 0) { ui.showToast('Please enter a valid amount.', 'error'); return; }
    const confirmText = `Swap ${get('swap-pay-input').value} ${get('swap-pay-currency').textContent} for ${get('swap-receive-input').value} ${get('swap-receive-currency').textContent}?`;
    
    ui.confirmAction(confirmText, async () => {
        try {
            const result = swapIsDtcToUsdt ? await api.swapDraicorToUsdt(player.email, amount) : await api.swapUsdtToDraicor(player.email, amount);
            player.usdtBalance = result.newUsdtBalance;
            player.draicorCoins = result.newDraicorCoins;
            localStorage.setItem('draicor_session', JSON.stringify(player));
            ui.updateDashboardUI(player);
            ui.updateWalletUI(player, swapIsDtcToUsdt);
            ui.showToast(result.message, 'success');
            setTimeout(() => ui.showWalletView('wallet-main-view'), 2000);
        } catch(error) { ui.showToast(error.message, 'error'); }
    });
}

async function handleDepositRequest() {
    const amount = get('deposit-amount-input').value;
    try {
        const result = await api.requestDeposit(player.email, amount, get('wallet-message'));
        currentDepositId = result.depositId;
        get('deposit-exact-amount').textContent = parseFloat(result.amount).toFixed(2);
        get('deposit-step1').classList.add('hidden');
        get('deposit-step2').classList.remove('hidden');
        ui.showDepositMethod(''); // Hide both methods initially
    } catch(error) { ui.showToast(error.message, 'error'); }
}

async function handleSubmitProof(proof, proofType) {
    if (!proof.trim()) { ui.showToast("Proof ID cannot be empty.", "error"); return; }
    try {
        const result = await api.submitDepositProof(player.email, currentDepositId, proof, proofType, get('wallet-message'));
        ui.showToast(result.message, 'success');
        get('deposit-step2').classList.add('hidden');
        get('deposit-step1').classList.remove('hidden');
        get('deposit-amount-input').value = '';
        get('deposit-txid-input').value = '';
        get('deposit-p2p-input').value = '';
        setTimeout(() => ui.showWalletView('wallet-main-view'), 2000);
    } catch(error) { ui.showToast(error.message, 'error'); }
}

async function handleShowHistory() {
    ui.showWalletView('wallet-history-view');
    const tbody = get('unified-history-tbody');
    tbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
    try {
        const history = await api.getUnifiedPlayerHistory(player.email);
        ui.renderUnifiedHistory(history);
    } catch (error) {
        ui.showToast(error.message, 'error');
        tbody.innerHTML = '<tr><td colspan="5">Error loading history.</td></tr>';
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Login
    get('request-code-btn').addEventListener('click', handleRequestCode);
    get('verify-code-btn').addEventListener('click', handleVerifyCode);
    get('back-to-login-link').addEventListener('click', (e) => { e.preventDefault(); ui.showLoginScreen(); });
    
    // Dashboard
    get('logout-btn').addEventListener('click', handleLogout);
    get('play-btn').addEventListener('click', () => {
        ui.showGameView();
        game.initializeAndStartGame(player, (finalScore) => {
            game.stopGame();
            player.draicorCoins = finalScore;
            api.savePlayerData(player.email, { draicorCoins: player.draicorCoins, usdtBalance: player.usdtBalance });
            ui.showDashboard();
            ui.updateDashboardUI(player);
        });
    });
    get('store-btn').addEventListener('click', handleShowStore);
    get('inventory-btn').addEventListener('click', handleShowInventory);
    get('equipment-btn').addEventListener('click', handleShowEquipment);
    get('payments-btn').addEventListener('click', handleShowPayments);
    get('ranking-btn').addEventListener('click', handleShowRanking);
    get('wallet-btn').addEventListener('click', handleShowWallet);
    
    // Equipment
    document.querySelectorAll('.equipment-slot').forEach(slot => {
        slot.addEventListener('click', () => {
            const slotName = slot.dataset.slot;
            ui.renderItemSelection(player, slotName, handleEquip, (slotToUnequip) => handleEquip(null, slotToUnequip));
            ui.showModal('item-selection-modal');
        });
    });

    // Modal Close Buttons
    get('close-payments-modal').addEventListener('click', () => ui.hideModal('payments-modal'));
    get('close-ranking-modal').addEventListener('click', () => ui.hideModal('ranking-modal'));
    get('close-store-modal').addEventListener('click', () => ui.hideModal('store-modal'));
    get('close-inventory-modal').addEventListener('click', () => ui.hideModal('inventory-modal'));
    get('close-equipment-modal').addEventListener('click', () => ui.hideModal('equipment-modal'));
    get('close-item-selection-modal').addEventListener('click', () => ui.hideModal('item-selection-modal'));
    get('close-wallet-modal').addEventListener('click', () => ui.hideModal('wallet-modal'));

    // Wallet
    get('show-deposit-btn').addEventListener('click', () => ui.showWalletView('wallet-deposit-view'));
    get('show-withdraw-btn').addEventListener('click', () => ui.showWalletView('wallet-withdraw-view'));
    get('show-swap-btn').addEventListener('click', () => ui.showWalletView('wallet-swap-view'));
    get('show-history-btn').addEventListener('click', handleShowHistory);
    document.querySelectorAll('.back-to-wallet-main').forEach(btn => btn.addEventListener('click', () => ui.showWalletView('wallet-main-view')));
    get('withdraw-btn').addEventListener('click', handleWithdraw);
    get('deposit-request-btn').addEventListener('click', handleDepositRequest);
    get('deposit-method-wallet').addEventListener('click', () => ui.showDepositMethod('wallet'));
    get('deposit-method-p2p').addEventListener('click', () => ui.showDepositMethod('p2p'));
    get('deposit-submit-txid-btn').addEventListener('click', () => handleSubmitProof(get('deposit-txid-input').value, 'txid'));
    get('deposit-submit-p2p-btn').addEventListener('click', () => handleSubmitProof(get('deposit-p2p-input').value, 'p2p'));
    get('swap-execute-btn').addEventListener('click', handleExecuteSwap);
    get('swap-flipper').addEventListener('click', () => { 
        swapIsDtcToUsdt = !swapIsDtcToUsdt; 
        ui.updateWalletUI(player, swapIsDtcToUsdt); 
    });
    get('swap-pay-input').addEventListener('input', (e) => {
        const amount = parseFloat(e.target.value);
        const receiveInput = get('swap-receive-input');
        if (!isNaN(amount)) { 
            receiveInput.value = swapIsDtcToUsdt ? (amount / SWAP_RATE).toFixed(6) : Math.floor(amount * SWAP_RATE); 
        } else { 
            receiveInput.value = ''; 
        }
    });
}

// --- App Start ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkSession();
});
