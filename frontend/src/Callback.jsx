import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LuLoaderCircle } from "react-icons/lu";

function Callback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState("Authenticating...");
    const hasFetched = useRef(false);

    // This URL will point to your Vercel FastAPI backend
    const BACKEND_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    useEffect(() => {
        // Prevent React strict mode double-firing
        if (hasFetched.current) return;
        hasFetched.current = true;

        const handleCallback = async () => {
            const code = searchParams.get('code');
            const error = searchParams.get('error');

            if (error) {
                setStatus(`Authentication failed: ${error}`);
                setTimeout(() => navigate('/'), 3000);
                return;
            }

            if (!code) {
                setStatus("Invalid request: No authorization code found.");
                setTimeout(() => navigate('/'), 3000);
                return;
            }

            // Grab the PKCE verifier we saved before redirecting
            const codeVerifier = localStorage.getItem('pkce_code_verifier');

            if (!codeVerifier) {
                setStatus("Authentication failed: Missing PKCE verifier.");
                setTimeout(() => navigate('/'), 3000);
                return;
            }

            // Determine which redirect_uri the user actually used
            const redirectUri = window.location.origin.includes('localhost')
                ? 'http://localhost:5010/callback'
                : 'https://dhakir.pages.dev/callback';

            try {
                setStatus("Exchanging secure token...");

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
                    throw new Error('Backend failed to exchange token');
                }

                const data = await response.json();
                console.log("🎉 SUCCESS! Data from FastAPI:", data);

                // Let's temporarily increase the delay to 5 seconds so you can read the console
                setStatus("Success! Check your browser console.");
                localStorage.removeItem('pkce_code_verifier');

                setTimeout(() => {
                    navigate('/');
                }, 5000); // Increased from 1000 to 5000

            } catch (err) {
                console.error(err);
                setStatus("Something went wrong communicating with the server.");
                setTimeout(() => navigate('/'), 3000);
            }
        };

        handleCallback();
    }, [searchParams, navigate, BACKEND_API_URL]);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#1a1b1d] text-gray-200">
            <LuLoaderCircle size={40} className="animate-spin text-emerald-500 mb-4" />
            <h2 className="text-xl font-medium">{status}</h2>
            <p className="text-sm text-gray-500 mt-2">Please wait while we securely log you in.</p>
        </div>
    );
}

export default Callback;