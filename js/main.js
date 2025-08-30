import { requestLoginCode, loginWithCode } from './api.js';

try {
    console.log("LOGIN TEST SCRIPT V2 LOADED");

    // Elementos del DOM
    const messageOverlay = document.getElementById('message-overlay');
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email-input');
    const codeInput = document.getElementById('code-input');
    const requestLoginCodeBtn = document.getElementById('request-code-btn');
    const loginBtn = document.getElementById('login-btn');
    const loginMessage = document.getElementById('login-message');
    
    // --- Login Handlers ---
    async function handleRequestCode() {
        const email = emailInput.value;
        if (!email) {
            loginMessage.textContent = "Please enter an email.";
            return;
        }
        loginMessage.textContent = "Requesting code...";
        requestLoginCodeBtn.disabled = true;
        const result = await requestLoginCode(email);
        loginMessage.textContent = result.message;
        
        if (result.success) {
            codeInput.style.display = 'block';
            loginBtn.style.display = 'block';
            requestLoginCodeBtn.style.display = 'none';
        } else {
             requestLoginCodeBtn.disabled = false;
        }
    }

    async function handleLogin() {
        const email = emailInput.value;
        const code = codeInput.value;
        if (!code) {
            loginMessage.textContent = "Please enter the code.";
            return;
        }
        loginMessage.textContent = "Logging in...";
        loginBtn.disabled = true;
        
        const result = await loginWithCode(email, code);

        if (result.success) {
            loginMessage.textContent = "LOGIN SUCCESSFUL! Test passed.";
            // Normalmente aquí iniciaríamos el juego.
        } else {
            loginMessage.textContent = `Login failed: ${result.message}`;
            loginBtn.disabled = false;
        }
    }

    // --- Event Listeners ---
    requestLoginCodeBtn.addEventListener('click', handleRequestCode);
    loginBtn.addEventListener('click', handleLogin);

    // --- Initialization ---
    window.addEventListener('load', () => {
        console.log("Window loaded. Showing login form.");
        // Forzamos la visualización del formulario
        if (messageOverlay) messageOverlay.style.display = 'flex';
        if (loginForm) loginForm.style.display = 'flex';
    });

} catch (e) {
    console.error("FATAL ERROR:", e);
    // Muestra el error directamente en la página para depuración
    document.body.innerHTML = `<div style="color: red; font-family: monospace; padding: 20px;"><h1>Error</h1><p>${e.message}</p><pre>${e.stack}</pre></div>`;
}

