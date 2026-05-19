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

# ── Quran Foundation Content API Token Management ─────────────────────────────

class QfTokenCache:
    """
    Thread-safe (asyncio) cache for a Quran Foundation Client Credentials token.
    Stores only the token string and its absolute expiry timestamp; all other
    state is internal and never leaked to callers.
    """

    _AUTH_BASE = {
        "prelive": "https://prelive-oauth2.quran.foundation",
        "production": "https://oauth2.quran.foundation",
    }
    _API_BASE = {
        "prelive": "https://apis-prelive.quran.foundation",
        "production": "https://apis.quran.foundation",
    }

    def __init__(self):
        self._lock = asyncio.Lock()
        self._token: str | None = None
        self._expires_at: float = 0.0

        env = os.environ.get("QF_ENV", "prelive")
        if env not in self._AUTH_BASE:
            raise ValueError(
                f"Invalid QF_ENV value: {env!r}. Expected 'prelive' or 'production'."
            )
        self.auth_base_url = self._AUTH_BASE[env]
        self.api_base_url = self._API_BASE[env]

    def clear(self) -> None:
        """Invalidate the cached token (called after a 401 from the Content API)."""
        self._token = None
        self._expires_at = 0.0

    async def get_access_token(self) -> str:
        """
        Return a valid access token, fetching a new one when needed.

        Fast path (no lock): return the cached token if it is still valid
        for more than 30 seconds.

        Slow path (under lock): double-check, then request a fresh token.
        Only one coroutine at a time enters the slow path, so concurrent
        callers never trigger a token stampede.
        """
        # Fast path — avoid lock overhead for the common case
        if self._token and time.time() < self._expires_at - 30:
            return self._token

        # Slow path — at most one coroutine fetches a new token
        async with self._lock:
            # Re-check after acquiring the lock (another coroutine may have
            # already fetched a fresh token while we were waiting)
            if self._token and time.time() < self._expires_at - 30:
                return self._token

            client_id = os.environ.get("QF_CLIENT_ID")
            client_secret = os.environ.get("QF_CLIENT_SECRET")
            if not client_id or not client_secret:
                raise ValueError(
                    "Server OAuth configuration is missing "
                    "(QF_CLIENT_ID or QF_CLIENT_SECRET)."
                )

            async with httpx.AsyncClient() as http:
                resp = await http.post(
                    f"{self.auth_base_url}/oauth2/token",
                    auth=(client_id, client_secret),
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    data={"grant_type": "client_credentials", "scope": "content"},
                    timeout=30.0,
                )
                resp.raise_for_status()

            data = resp.json()
            self._token = data["access_token"]
            # Store absolute expiry; never store expires_in beyond this point
            self._expires_at = time.time() + data["expires_in"]
            return self._token  # type: ignore[return-value]


qf_cache = QfTokenCache()


# ── First Authenticated Content API Call: GET /content/api/v4/chapters ────────

@app.get("/api/chapters")
async def get_chapters(language: str = "en"):
    """
    Return all chapters from the Quran Foundation Content API.

    Query params
    ------------
    language : str, default "en"
        Language code forwarded to the upstream API (e.g. "en", "ar").

    Response
    --------
    { "chapters": [ { "id": 1, "name_simple": "Al-Fatihah", ... }, ... ] }
    """
    client_id = os.environ.get("QF_CLIENT_ID")
    if not client_id:
        raise HTTPException(
            status_code=500,
            detail="Server OAuth configuration is missing (QF_CLIENT_ID).",
        )

    async def _fetch_chapters(token: str) -> httpx.Response:
        """Single authenticated GET against the upstream chapters endpoint."""
        async with httpx.AsyncClient() as http:
            return await http.get(
                f"{qf_cache.api_base_url}/content/api/v4/chapters",
                params={"language": language},
                headers={
                    "x-auth-token": token,   # required by Content API
                    "x-client-id": client_id, # required by Content API
                },
                timeout=30.0,
            )

    try:
        token = await qf_cache.get_access_token()
        response = await _fetch_chapters(token)

        # On 401: clear stale token, re-request once, retry once — no loop
        if response.status_code == 401:
            qf_cache.clear()
            token = await qf_cache.get_access_token()
            response = await _fetch_chapters(token)

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Upstream chapters request failed: {response.text}",
            )

        data = response.json()

        # Verify success: response must contain a non-empty 'chapters' list
        chapters = data.get("chapters")
        if not isinstance(chapters, list) or len(chapters) == 0:
            raise HTTPException(
                status_code=502,
                detail="Upstream response did not contain a valid 'chapters' array.",
            )

        return data  # { "chapters": [...] } — no credentials included

    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to reach Content API: {exc}",
        )
    except HTTPException:
        raise  # re-raise FastAPI exceptions unchanged
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Content API Proxy ─────────────────────────────────────────────────────────

@app.get("/content/api/v4/{path:path}")
async def proxy_content_api(path: str, request: Request):
    client_id = os.environ.get("QF_CLIENT_ID")
    if not client_id:
        raise HTTPException(
            status_code=500,
            detail="Server OAuth configuration is missing (QF_CLIENT_ID).",
        )

    async def _call(token: str) -> httpx.Response:
        """Fire a single GET at the upstream Content API."""
        async with httpx.AsyncClient() as http:
            return await http.get(
                f"{qf_cache.api_base_url}/content/api/v4/{path}",
                params=dict(request.query_params),
                headers={"x-auth-token": token, "x-client-id": client_id},
                timeout=30.0,
            )

    try:
        token = await qf_cache.get_access_token()
        response = await _call(token)

        # On 401: clear stale token, re-request once, retry once — no loop
        if response.status_code == 401:
            qf_cache.clear()
            token = await qf_cache.get_access_token()
            response = await _call(token)

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code, detail=response.text
            )

        return response.json()

    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to communicate with Content API: {exc}",
        )
    except HTTPException:
        raise  # re-raise FastAPI exceptions unchanged
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

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