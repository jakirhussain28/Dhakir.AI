import os
import json
import re
import asyncio
import time
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv
from QuranContent import router as quran_content_router

# Load environment variables
load_dotenv()

# Import your function
# from Quran_Guide import generate_quran_guidance

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

# --- REQUEST MODELS ---
# class GuidanceRequest(BaseModel):
#     user_input: str

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

# @app.post("/api/guidance")
# async def get_guidance(request: GuidanceRequest):
#     try:
#         response_data = generate_quran_guidance(request.user_input)
#         
#         if isinstance(response_data, str):
#             try:
#                 response_data = json.loads(response_data)
#             except json.JSONDecodeError:
#                 pass 
# 
#         return {
#             "status": "success",
#             "data": response_data
#         }
# 
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

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


# ── User API Proxy ────────────────────────────────────────────────────────────

_USER_API_BASE = {
    "prelive":    "https://apis-prelive.quran.foundation/auth",
    "production": "https://apis.quran.foundation/auth",
}

@app.api_route("/userapi/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE"])
async def proxy_user_api(path: str, request: Request):
    """
    Generic proxy for Quran Foundation User API (v1).

    Reads the user's access token from the x-forwarded-auth header and injects
    the required x-auth-token + x-client-id headers before forwarding.
    """
    client_id = os.environ.get("QF_CLIENT_ID")
    if not client_id:
        raise HTTPException(
            status_code=500,
            detail="Server OAuth configuration is missing (QF_CLIENT_ID).",
        )

    # Retrieve the user JWT forwarded by the frontend
    user_token = request.headers.get("x-forwarded-auth")
    if not user_token:
        raise HTTPException(
            status_code=401,
            detail="Missing x-forwarded-auth header. User must be authenticated.",
        )

    env = os.environ.get("QF_ENV", "prelive")
    
    # OpenAPI spec overrides server for these paths to use quran-reflect.
    if path.startswith("users/") or path.startswith("posts/") or path.startswith("notes/") or path.startswith("rooms/") or path.startswith("comments/") or path.startswith("tags/"):
        user_api_base = "https://apis-prelive.quran.foundation/quran-reflect" if env == "prelive" else "https://apis.quran.foundation/quran-reflect"
    else:
        user_api_base = _USER_API_BASE.get(env, _USER_API_BASE["prelive"])

    # Build upstream URL
    upstream_url = f"{user_api_base}/v1/{path}"

    # Forward query params as-is
    params = dict(request.query_params)

    # Read request body (for POST / PATCH / PUT)
    body = await request.body()

    # Build forwarded headers: inject QF auth, drop hop-by-hop/proxy headers
    forward_headers = {
        "x-auth-token": user_token,
        "x-client-id":  client_id,
        "Content-Type":  request.headers.get("content-type", "application/json"),
        "Accept":        "application/json",
    }

    # Forward x-timezone if present (required by streaks API for accurate day calc)
    x_timezone = request.headers.get("x-timezone")
    if x_timezone:
        forward_headers["x-timezone"] = x_timezone

    async def _do_request() -> httpx.Response:
        """Fire a single request at the upstream User API."""
        async with httpx.AsyncClient() as http:
            return await http.request(
                method=request.method,
                url=upstream_url,
                params=params,
                headers=forward_headers,
                content=body if body else None,
                timeout=30.0,
            )

    try:
        # First attempt
        try:
            upstream_response = await _do_request()
        except httpx.RequestError:
            # Network glitch — retry once
            upstream_response = await _do_request()

        # On transient 502 from upstream: retry once (no loop)
        if upstream_response.status_code == 502:
            upstream_response = await _do_request()

        # Return upstream response body and status to the frontend
        if upstream_response.status_code == 204:
            return {}   # No Content — return empty object

        if upstream_response.status_code >= 400:
            print(f"[USERAPI PROXY] {request.method} {upstream_url} -> {upstream_response.status_code}")
            print(f"[USERAPI PROXY] Response: {upstream_response.text[:500]}")
            print(f"[USERAPI PROXY] Request headers: {forward_headers}")
            raise HTTPException(
                status_code=upstream_response.status_code,
                detail=upstream_response.text,
            )

        # Some endpoints return empty body on success (e.g. DELETE)
        if not upstream_response.content:
            return {}

        response_data = upstream_response.json()

        # For GET users/profile, Fetch from auth and merge.
        if request.method == "GET" and path == "users/profile":
            auth_base = _USER_API_BASE.get(env, _USER_API_BASE["prelive"])
            auth_url = f"{auth_base}/v1/users/profile"
            try:
                async with httpx.AsyncClient() as http:
                    auth_resp = await http.get(auth_url, headers=forward_headers, timeout=10.0)
                    if auth_resp.status_code == 200:
                        auth_data = auth_resp.json()
                        # Merge auth data into response_data
                        if isinstance(response_data, dict) and isinstance(auth_data, dict):
                            # Usually response is the profile object or {data: profile}
                            target = response_data.get("data", response_data) if "data" in response_data else response_data
                            source = auth_data.get("data", auth_data) if "data" in auth_data else auth_data
                            # Overwrite missing fields (like email) from auth_data into target
                            for k, v in source.items():
                                if k not in target or not target[k]:
                                    target[k] = v
            except Exception as e:
                print(f"Failed to fetch auth profile for merge: {e}")

        return response_data

    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to communicate with User API: {exc}",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)