import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import brandLogo from './assets/brandLogo.svg';

function Callback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [hasError, setHasError] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const hasFetched = useRef(false);

    // Read the user's theme preference from localStorage
    const theme = localStorage.getItem('app-theme') || 'light';
    const isLight = theme === 'light';

    // Use localhost backend when on localhost to avoid CORS issues with LAN IP
    const BACKEND_API_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:8000'
        : (import.meta.env.VITE_API_URL || 'http://localhost:8000');

    useEffect(() => {
        // Prevent React strict mode double-firing
        if (hasFetched.current) return;
        hasFetched.current = true;

        const handleCallback = async () => {
            const code = searchParams.get('code');
            const state = searchParams.get('state');
            const error = searchParams.get('error');

            if (error) {
                setHasError(true);
                setErrorMsg(`Authentication failed: ${error}`);
                setTimeout(() => navigate('/'), 3000);
                return;
            }

            if (!code) {
                setHasError(true);
                setErrorMsg('No authorization code found.');
                setTimeout(() => navigate('/'), 3000);
                return;
            }

            const savedState = localStorage.getItem('oauth_state');
            if (!state || state !== savedState) {
                setHasError(true);
                setErrorMsg('State mismatch. Please try again.');
                setTimeout(() => navigate('/'), 3000);
                return;
            }

            // Grab the PKCE verifier we saved before redirecting
            const codeVerifier = localStorage.getItem('pkce_code_verifier');

            if (!codeVerifier) {
                setHasError(true);
                setErrorMsg('Missing PKCE verifier. Please try again.');
                setTimeout(() => navigate('/'), 3000);
                return;
            }

            // Determine which redirect_uri the user actually used
            const redirectUri = window.location.origin.includes('localhost')
                ? 'http://localhost:5010/callback'
                : 'https://dhakir.pages.dev/callback';

            try {
                const response = await fetch(`${BACKEND_API_URL}/api/auth/callback`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code: code,
                        code_verifier: codeVerifier,
                        redirect_uri: redirectUri
                    })
                });

                if (!response.ok) {
                    const errData = await response.json();
                    console.error("Backend Error:", errData);
                    throw new Error(errData.detail || 'Token exchange failed');
                }

                const data = await response.json();

                if (data.status === 'success' && data.session) {
                    if (data.session.id_token) {
                        try {
                            const payloadBase64 = data.session.id_token.split('.')[1];
                            const decodedJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
                            const payload = JSON.parse(decodedJson);
                            
                            const savedNonce = localStorage.getItem('oauth_nonce');
                            if (payload.nonce !== savedNonce) {
                                throw new Error('Nonce mismatch in ID Token.');
                            }
                            localStorage.setItem('id_token', data.session.id_token);
                        } catch (e) {
                            console.error('ID Token validation error:', e);
                            throw new Error('ID Token validation failed.');
                        }
                    }

                    localStorage.setItem('access_token', data.session.access_token);
                    if (data.session.refresh_token) {
                        localStorage.setItem('refresh_token', data.session.refresh_token);
                    }
                    
                    if (data.session.expires_in) {
                        const expiresAt = Date.now() + (data.session.expires_in * 1000);
                        localStorage.setItem('token_expires_at', expiresAt.toString());
                    }
                }

                localStorage.removeItem('pkce_code_verifier');
                localStorage.removeItem('oauth_state');
                localStorage.removeItem('oauth_nonce');

                // Navigate home after successful login
                setTimeout(() => navigate('/'), 1000);

            } catch (err) {
                console.error("Token exchange error:", err.message, err);
                setHasError(true);
                setErrorMsg(err.message || 'Something went wrong.');
                setTimeout(() => navigate('/'), 4000);
            }
        };

        handleCallback();
    }, [searchParams, navigate, BACKEND_API_URL]);

    return (
        <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-colors duration-300
            ${isLight ? 'bg-[#f5f5f0]' : 'bg-[rgb(22,22,24)]'}`}>
            {/* Logo */}
            <img
                src={brandLogo}
                alt="Dhakir Logo"
                className="w-52 sm:w-60 h-auto mb-8 opacity-90"
                style={{ filter: isLight ? 'none' : 'brightness(0) invert(1)' }}
            />

            {/* Spinner */}
            <div className={`w-6 h-6 border-2 rounded-full animate-spin mb-5
                ${isLight ? 'border-stone-300 border-t-emerald-600' : 'border-gray-600 border-t-emerald-500'}`} />

            {/* Status text */}
            {hasError ? (
                <p className="text-sm text-red-500 text-center px-6 max-w-xs">{errorMsg}</p>
            ) : (
                <p className={`text-sm tracking-wide ${isLight ? 'text-stone-400' : 'text-gray-500'}`}>
                    Please wait while we securely log you in.
                </p>
            )}
        </div>
    );
}

export default Callback;