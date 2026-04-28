// src/utils/auth.js

const CLIENT_ID = import.meta.env.VITE_QURAN_CLIENT_ID;
const OAUTH_ENDPOINT = 'https://prelive-oauth2.quran.foundation/oauth2/auth';

// Automatically handles local dev vs production environments
const REDIRECT_URI = window.location.origin.includes('localhost')
    ? 'http://localhost:5010/callback' // Matches your Vite port
    : 'https://dhakir.pages.dev/callback';

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
export const initiateLogin = async () => {
    if (!CLIENT_ID) {
        console.error("Missing VITE_QURAN_CLIENT_ID in .env file");
        return;
    }

    const codeVerifier = generateRandomString(64);

    // Save verifier to localStorage so Callback.jsx can use it later
    localStorage.setItem('pkce_code_verifier', codeVerifier);

    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Construct the Quran Foundation login URL
    const authUrl = new URL(OAUTH_ENDPOINT);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');
    authUrl.searchParams.append('scope', 'openid profile email');

    // Redirect the browser!
    window.location.href = authUrl.toString();
};