// src/utils/auth.js

const CLIENT_ID = import.meta.env.VITE_QURAN_CLIENT_ID;
const OAUTH_ENDPOINT = 'https://prelive-oauth2.quran.foundation/oauth2/auth';

// Automatically handles local dev vs production environments
const REDIRECT_URI = window.location.origin.includes('localhost')
    ? 'http://localhost:5010/callback' // Matches your Vite port
    : 'https://dhakir.pages.dev/callback';

const BACKEND_API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : (import.meta.env.VITE_API_URL || 'http://localhost:8000');

// 1. Generate a random secure string
const generateRandomString = (length) => {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
};

// 2. Hash the string using SHA-256
const generateCodeChallenge = async (codeVerifier) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);

    return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
};

// 3. The function your button will call
// 3. The function your button will call
export const initiateLogin = async () => {
    if (!CLIENT_ID) {
        console.error("Missing VITE_QURAN_CLIENT_ID in .env file");
        return;
    }

    const codeVerifier = generateRandomString(64);

    // NEW: Generate state and nonce (must be at least 8 chars)
    const state = generateRandomString(16);
    const nonce = generateRandomString(16);

    // Save verifier, state, and nonce to localStorage so Callback.jsx can use them later
    localStorage.setItem('pkce_code_verifier', codeVerifier);
    localStorage.setItem('oauth_state', state); // Save state to verify upon return
    localStorage.setItem('oauth_nonce', nonce); // Save nonce to verify id_token claims

    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Construct the Quran Foundation login URL
    const authUrl = new URL(OAUTH_ENDPOINT);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');
    authUrl.searchParams.append('scope', 'openid user bookmark collection streak reading_session activity_day offline_access');

    // Append the required state and nonce parameters
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('nonce', nonce);

    // Force the login screen to appear every time (prevents auto-login with stale session)
    authUrl.searchParams.append('prompt', 'login');

    // Redirect the browser!
    window.location.href = authUrl.toString();
};

// 4. Token management and Retrieval
export const getAccessToken = () => localStorage.getItem('access_token');
export const getIdToken = () => localStorage.getItem('id_token');

export const isAuthenticated = () => {
    const expiresAt = localStorage.getItem('token_expires_at');
    if (!expiresAt) return false;
    return Date.now() < parseInt(expiresAt, 10);
};

export const logout = () => {
    // Clear all auth-related data from localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('id_token');
    localStorage.removeItem('token_expires_at');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('oauth_state');
    localStorage.removeItem('pkce_code_verifier');
    localStorage.removeItem('oauth_nonce');

    // Redirect to the correct app root
    const homeUrl = window.location.origin.includes('localhost')
        ? 'http://localhost:5010/'
        : 'https://dhakir.pages.dev/';

    window.location.href = homeUrl;
};

export const getUserProfile = () => {
    const token = getIdToken();
    if (!token) return null;
    
    try {
        const payloadBase64 = token.split('.')[1];
        if (!payloadBase64) return null;
        
        // Decode base64url to string
        const decodedJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(decodedJson);
    } catch (e) {
        console.error('Error decoding id_token', e);
        return null;
    }
};

export const refreshAccessToken = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
        logout();
        return null;
    }

    try {
        const response = await fetch(`${BACKEND_API_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken })
        });

        if (!response.ok) {
            throw new Error('Failed to refresh token');
        }

        const data = await response.json();
        
        if (data.status === 'success' && data.session) {
            localStorage.setItem('access_token', data.session.access_token);
            if (data.session.id_token) {
                localStorage.setItem('id_token', data.session.id_token);
            }
            if (data.session.refresh_token) {
                localStorage.setItem('refresh_token', data.session.refresh_token);
            }
            if (data.session.expires_in) {
                const expiresAt = Date.now() + (data.session.expires_in * 1000);
                localStorage.setItem('token_expires_at', expiresAt.toString());
            }
            return data.session;
        } else {
            throw new Error('Invalid session format in refresh response');
        }
    } catch (error) {
        console.error('Token refresh failed:', error);
        logout();
        return null;
    }
};

let refreshTimeoutId = null;

export const setupTokenRefresh = () => {
    if (refreshTimeoutId) {
        clearTimeout(refreshTimeoutId);
    }

    const expiresAt = localStorage.getItem('token_expires_at');
    const refreshToken = localStorage.getItem('refresh_token');

    if (!expiresAt || !refreshToken) return;

    const timeUntilExpiry = parseInt(expiresAt, 10) - Date.now();
    
    // Refresh 1 minute (60000ms) before it actually expires
    const refreshTime = timeUntilExpiry - 60000;

    if (refreshTime > 0) {
        refreshTimeoutId = setTimeout(async () => {
            const newSession = await refreshAccessToken();
            if (newSession) {
                setupTokenRefresh();
            }
        }, refreshTime);
    } else {
        // Already expired or within 1 minute of expiring, refresh immediately
        refreshAccessToken().then(session => {
            if (session) setupTokenRefresh();
        });
    }
};