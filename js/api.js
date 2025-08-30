const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxAcJccwksF_HS8zYdCu_js82EeaW2rMDhEDtLQYuZIB_RVxDnrGb55e1Q2kKSDnfupsQ/exec";

async function apiCall(action, data) {
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            credentials: 'omit',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, ...data })
        });
        if (!response.ok) {
            return { success: false, message: `Server error: ${response.status}` };
        }
        return await response.json();
    } catch (error) {
        console.error('API Call Error:', error);
        return { success: false, message: 'Network error or script execution failed.' };
    }
}

// Modificado para aceptar el token de reCAPTCHA
export async function requestLoginCode(email, recaptchaToken) {
    return await apiCall('requestLoginCode', { email, recaptchaToken });
}

export async function loginWithCode(email, code) {
    return await apiCall('loginWithCode', { email, code });
}

