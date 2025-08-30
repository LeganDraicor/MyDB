// =================================================================================
// ARCHIVO DE CONFIGURACIÓN DE LA API
// =================================================================================

// INSTRUCCIÓN: 
// 1. Ve a tu proyecto de Google Apps Script.
// 2. Haz clic en "Implementar" > "Nueva implementación".
// 3. Selecciona "Aplicación web".
// 4. En "Quién tiene acceso", selecciona "Cualquier persona".
// 5. Haz clic en "Implementar".
// 6. Copia la "URL de la aplicación web" y pégala aquí abajo.
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxAcJccwksF_HS8zYdCu_js82EeaW2rMDhEDtLQYuZIB_RVxDnrGb55e1Q2kKSDnfupsQ/exec";

// =================================================================================

async function callBackend(action, data = {}) {
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8', // Required for Apps Script simple POST
            },
            body: JSON.stringify({ action, ...data })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result;

    } catch (error) {
        console.error('Error calling backend:', error);
        return { success: false, message: error.message };
    }
}

export function requestLoginCode(email) {
    return callBackend('requestLoginCode', { email });
}

export function loginWithCode(email, code) {
    return callBackend('loginWithCode', { email, code });
}

export function updatePlayerScore(email, score) {
    return callBackend('updateGameplayScore', { email, score });
}
