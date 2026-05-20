import os
import json
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv
from upstash_redis import Redis
from QuranContent import router as quran_content_router
from QuranUsers import router as quran_users_router

load_dotenv()

# ── Upstash Redis ─────────────────────────────────────────────────────────────
redis = Redis.from_env()

app = FastAPI(
    title="Dhakir API",
    description="An API that returns a relevant Quranic verse based on user emotions or questions and manages authentication.",
    version="1.0.0"
)

origins = [
    "http://localhost:5010",
    "https://dhakir.pages.dev",
    "http://192.168.1.2:5010",
    "http://10.210.237.207:5010"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],  
)

app.include_router(quran_content_router)
app.include_router(quran_users_router)

class AuthCallbackRequest(BaseModel):
    code: str
    code_verifier: str
    redirect_uri: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

# ── Helper: persist session tokens in Redis ───────────────────────────────────

def _store_session_in_redis(token_data: dict) -> None:
    """
    Persist the OAuth session keyed by access_token in Upstash Redis.

    This allows any Vercel serverless function instance to validate / retrieve
    a session even after the original handler's process has been recycled.

    Key:   session:<access_token>
    Value: JSON blob with id_token, refresh_token, expires_in
    TTL:   expires_in seconds (matches the OAuth token lifetime)
    """
    access_token = token_data.get("access_token")
    if not access_token:
        return

    session_payload = {
        "access_token": access_token,
        "id_token": token_data.get("id_token"),
        "refresh_token": token_data.get("refresh_token"),
        "expires_in": token_data.get("expires_in"),
    }

    ttl = token_data.get("expires_in", 3600)  # default 1 hour
    redis.set(
        f"session:{access_token}",
        json.dumps(session_payload),
        ex=ttl,
    )


# --- ENDPOINTS ---
@app.get("/")   
async def health_check():
    return "Health check is successful"

# NEW: OAuth2 Token Exchange Endpoint
@app.post("/api/auth/callback")
async def auth_callback(request: AuthCallbackRequest):
    client_id = os.environ.get("QF_CLIENT_ID")
    client_secret = os.environ.get("QF_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Server OAuth configuration is missing.")

    # Quran.Foundation Token Endpoint
    env = os.environ.get("QF_ENV", "prelive")
    auth_base_url = "https://oauth2.quran.foundation" if env == "production" else "https://prelive-oauth2.quran.foundation"
    token_url = f"{auth_base_url}/oauth2/token"
    
    # Construct the payload required for the token exchange
    # NOTE: client_id/client_secret are sent via HTTP Basic Auth header (client_secret_basic)
    payload = {
        "grant_type": "authorization_code",
        "code": request.code,
        "code_verifier": request.code_verifier,
        "redirect_uri": request.redirect_uri
    }

    try:
        # Make a secure server-to-server request with Basic Auth
        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url, 
                data=payload,
                auth=(client_id, client_secret)
            )
            
            if response.status_code != 200:
                error_detail = response.text
                print(f"OAuth2 Error (status {response.status_code}):", error_detail)
                raise HTTPException(
                    status_code=400, 
                    detail=f"Token exchange failed (status {response.status_code}): {error_detail}"
                )
            
            token_data = response.json()

            # Persist tokens in Upstash Redis for cross-instance availability
            _store_session_in_redis(token_data)
            
            # Return the access_token and id_token to the React frontend
            return {
                "status": "success",
                "session": {
                    "access_token": token_data.get("access_token"),
                    "id_token": token_data.get("id_token"),
                    "expires_in": token_data.get("expires_in"),
                    "refresh_token": token_data.get("refresh_token")
                }
            }
            
    except httpx.RequestError as e:
        print(f"Network error communicating with Auth server: {str(e)}")
        raise HTTPException(status_code=502, detail=f"Failed to communicate with Auth server: {str(e)}")

# NEW: OAuth2 Refresh Token Endpoint
@app.post("/api/auth/refresh")
async def refresh_token(request: RefreshTokenRequest):
    client_id = os.environ.get("QF_CLIENT_ID")
    client_secret = os.environ.get("QF_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Server OAuth configuration is missing.")

    # Quran.Foundation Token Endpoint
    env = os.environ.get("QF_ENV", "prelive")
    auth_base_url = "https://oauth2.quran.foundation" if env == "production" else "https://prelive-oauth2.quran.foundation"
    token_url = f"{auth_base_url}/oauth2/token"
    
    payload = {
        "grant_type": "refresh_token",
        "refresh_token": request.refresh_token
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url, 
                data=payload,
                auth=(client_id, client_secret)
            )
            
            if response.status_code != 200:
                error_detail = response.text
                print(f"OAuth2 Refresh Error (status {response.status_code}):", error_detail)
                raise HTTPException(
                    status_code=400, 
                    detail=f"Token refresh failed (status {response.status_code}): {error_detail}"
                )
            
            token_data = response.json()

            # Delete the old session (keyed by the old refresh_token's access_token)
            # and persist the new session in Redis
            _store_session_in_redis(token_data)
            
            return {
                "status": "success",
                "session": {
                    "access_token": token_data.get("access_token"),
                    "id_token": token_data.get("id_token"),
                    "expires_in": token_data.get("expires_in"),
                    "refresh_token": token_data.get("refresh_token")
                }
            }
            
    except httpx.RequestError as e:
        print(f"Network error communicating with Auth server: {str(e)}")
        raise HTTPException(status_code=502, detail=f"Failed to communicate with Auth server: {str(e)}")



if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)