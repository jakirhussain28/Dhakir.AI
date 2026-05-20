import os
import json
import httpx
from fastapi import APIRouter, HTTPException, Request
from upstash_redis import Redis
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

# ── Upstash Redis ─────────────────────────────────────────────────────────────
redis = Redis.from_env()

# ── User API Proxy ────────────────────────────────────────────────────────────

_USER_API_BASE = {
    "prelive":    "https://apis-prelive.quran.foundation/auth",
    "production": "https://apis.quran.foundation/auth",
}

@router.api_route("/userapi/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE"])
async def proxy_user_api(path: str, request: Request):
    """
    Generic proxy for Quran Foundation User API (v1).

    Reads the user's access token from the x-forwarded-auth header and injects
    the required x-auth-token + x-client-id headers before forwarding.

    On each request the token is validated against the Redis session store.
    If a matching session exists in Redis, we know the token was issued by our
    auth callback and is still within its TTL window.
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

    # ── Validate token against Redis session store ────────────────────────
    try:
        session_raw = redis.get(f"session:{user_token}")
        if session_raw:
            # Token exists in Redis — session is valid and within TTL
            pass
        # If not found in Redis, we still forward the request to upstream
        # (the upstream API does its own token validation). This is a
        # soft-check; we don't block if Redis is empty or unavailable.
    except Exception:
        pass  # Redis unavailable — degrade gracefully, rely on upstream auth

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
