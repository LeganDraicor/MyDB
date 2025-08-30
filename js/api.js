const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxAcJccwksF_HS8zYdCu_js82EeaW2rMDhEDtLQYuZIB_RVxDnrGb55e1Q2kKSDnfupsQ/exec';

/**
 * Private helper to make API calls to the Google Apps Script backend.
 * @param {string} action - The function to call on the backend.
 * @param {object} payload - The data to send.
 * @param {HTMLElement} [messageElement] - Optional element to display loading/error messages.
 * @returns {Promise<any>} - The data from the backend.
 */
async function _apiCall(action, payload = {}, messageElement) {
    if (messageElement) messageElement.textContent = 'Loading...';
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            // The final payload includes the action name, which the backend doPost function uses to route the request.
            body: JSON.stringify({ action, ...payload })
        });
        const result = await response.json();
        if (messageElement) messageElement.textContent = '';
        if (result.status === 'error') throw new Error(result.message);
        
        return result.data;
    } catch (error) {
        console.error('API Call Error:', action, error);
        if (messageElement) { messageElement.textContent = error.message; }
        throw error; // Re-throw the error so the calling function can handle it.
    }
}

// --- Public API Functions ---

export async function requestLoginCode(email, captcha, messageElement) {
    return _apiCall('requestLoginCode', { email, captcha }, messageElement);
}

export async function verifyLoginCode(email, code, messageElement) {
    return _apiCall('verifyLoginCode', { email, code }, messageElement);
}

// Functions below this point require a logged-in user's email.
export async function savePlayerData(email, playerData) {
    return _apiCall('savePlayerData', { email, playerData });
}

export async function getPlayerInventory(email) {
    return _apiCall('getPlayerInventory', { email });
}

export async function getStoreItems(email) {
    return _apiCall('getStoreItems', { email });
}

export async function buyItem(email, itemID, quantity) {
    return _apiCall('buyItem', { email, itemID, quantity });
}

export async function upgradeItem(email, itemID) {
    return _apiCall('upgradeItem', { email, itemID });
}

export async function equipItem(email, itemID, slot) {
    return _apiCall('equipItem', { email, itemID, slot });
}

export async function getRanking() {
    // This is a public endpoint, so no email is needed.
    return _apiCall('getRanking', {});
}

export async function getPublicPayments(page) {
    // This is also public.
    return _apiCall('getPublicPayments', { page });
}

export async function requestWithdrawal(email, amount) {
    return _apiCall('requestWithdrawal', { email, amount });
}

export async function swapDraicorToUsdt(email, amount) {
    return _apiCall('swapDraicorToUsdt', { email, amount });
}

export async function swapUsdtToDraicor(email, amount) {
    return _apiCall('swapUsdtToDraicor', { email, amount });
}

export async function requestDeposit(email, amount, messageElement) {
    return _apiCall('requestDeposit', { email, amount }, messageElement);
}

export async function submitDepositProof(email, depositId, proof, proofType, messageElement) {
    // Note: The backend uses depositId to find the user, but we pass email for consistency.
    return _apiCall('submitDepositProof', { email, depositId, proof, proofType }, messageElement);
}

export async function getUnifiedPlayerHistory(email) {
    return _apiCall('getUnifiedPlayerHistory', { email });
}