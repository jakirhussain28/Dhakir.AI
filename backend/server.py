import os
import json
import re
import httpx # NEW: HTTP client for async requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import your function
from Quran_Guide import generate_quran_guidance

app = FastAPI(
    title="Dhakir API",
    description="An API that returns a relevant Quranic verse based on user emotions or questions and manages authentication.",
    version="1.0.0"
)

origins = [
    "http://localhost:5010",
    "https://dhakir.pages.dev",
    "http://192.168.1.2:5010"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],  
)

# --- REQUEST MODELS ---
class GuidanceRequest(BaseModel):
    user_input: str

class AuthCallbackRequest(BaseModel):
    code: str
    code_verifier: str
    redirect_uri: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

# --- ENDPOINTS ---
@app.get("/")   
async def health_check():
    return "Health check is successful"

@app.post("/api/guidance")
async def get_guidance(request: GuidanceRequest):
    try:
        response_data = generate_quran_guidance(request.user_input)
        
        if isinstance(response_data, str):
            try:
                response_data = json.loads(response_data)
            except json.JSONDecodeError:
                pass 

        return {
            "status": "success",
            "data": response_data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

# NEW: OAuth2 Token Exchange Endpoint
@app.post("/api/auth/callback")
async def auth_callback(request: AuthCallbackRequest):
    client_id = os.environ.get('QURAN_CLIENT_ID')
    client_secret = os.environ.get('QURAN_CLIENT_SECRET')

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Server OAuth configuration is missing.")

    # Quran.Foundation Pre-live Token Endpoint
    token_url = "https://prelive-oauth2.quran.foundation/oauth2/token"
    
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
    client_id = os.environ.get('QURAN_CLIENT_ID')
    client_secret = os.environ.get('QURAN_CLIENT_SECRET')

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Server OAuth configuration is missing.")

    token_url = "https://prelive-oauth2.quran.foundation/oauth2/token"
    
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

# NEW: Quran Foundation Content API Token Management
import asyncio
import time
from fastapi import Request

class QfTokenCache:
    def __init__(self):
        self._lock = asyncio.Lock()
        self._token = None
        self._expires_at = 0
        self._expires_in = 0
        
        env = os.environ.get("QF_ENV", "prelive")
        if env == "production":
            self.auth_base_url = "https://oauth2.quran.foundation"
            self.api_base_url = "https://apis.quran.foundation"
        else:
            self.auth_base_url = "https://prelive-oauth2.quran.foundation"
            self.api_base_url = "https://apis-prelive.quran.foundation"

    def clear(self):
        self._token = None
        self._expires_at = 0
        self._expires_in = 0

    async def get_access_token(self):
        now = time.time()
        if self._token and now < self._expires_at - 30:
            return {"access_token": self._token, "expires_in": self._expires_in}
            
        async with self._lock:
            now = time.time()
            if self._token and now < self._expires_at - 30:
                return {"access_token": self._token, "expires_in": self._expires_in}
                
            client_id = os.environ.get('QF_CLIENT_ID')
            client_secret = os.environ.get('QF_CLIENT_SECRET')
            if not client_id or not client_secret:
                raise ValueError("Server OAuth configuration is missing (QF_CLIENT_ID or QF_CLIENT_SECRET).")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.auth_base_url}/oauth2/token",
                    auth=(client_id, client_secret),
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    data={
                        "grant_type": "client_credentials",
                        "scope": "content",
                    },
                    timeout=30.0
                )
                response.raise_for_status()
                token_data = response.json()
                self._token = token_data["access_token"]
                self._expires_in = token_data["expires_in"]
                self._expires_at = time.time() + self._expires_in
                return {"access_token": self._token, "expires_in": self._expires_in}

qf_cache = QfTokenCache()

# NEW: Endpoint to get Content API token directly
@app.get("/api/auth/content-token")
async def get_content_token():
    try:
        token_info = await qf_cache.get_access_token()
        return {
            "access_token": token_info["access_token"],
            "expires_in": token_info["expires_in"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# NEW: Content API Proxy
@app.get("/content/api/v4/{path:path}")
async def proxy_content_api(path: str, request: Request):
    client_id = os.environ.get('QF_CLIENT_ID')
    if not client_id:
        raise HTTPException(status_code=500, detail="Server OAuth configuration is missing (QF_CLIENT_ID).")
    
    async def fetch_data(token_str):
        params = dict(request.query_params)
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{qf_cache.api_base_url}/content/api/v4/{path}",
                params=params,
                headers={
                    "x-auth-token": token_str,
                    "x-client-id": client_id,
                },
                timeout=30.0
            )
            return response

    try:
        token_info = await qf_cache.get_access_token()
        response = await fetch_data(token_info["access_token"])
        
        if response.status_code == 401:
            qf_cache.clear()
            token_info = await qf_cache.get_access_token()
            response = await fetch_data(token_info["access_token"])
            
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
            
        return response.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Failed to communicate with Content API: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)