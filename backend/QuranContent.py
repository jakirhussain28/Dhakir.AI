import os
import asyncio
import time
import httpx
from fastapi import APIRouter, HTTPException, Request

router = APIRouter()

# ── Quran Foundation Content API Token Management ─────────────────────────────

class QfTokenCache:
    """
    Thread-safe (asyncio) cache for a Quran Foundation Client Credentials token.
    Stores only the token string and its absolute expiry timestamp; all other
    state is internal and never leaked to callers.
    """

    def __init__(self):
        self._lock = asyncio.Lock()
        self._token: str | None = None
        self._expires_at: float = 0.0

        self.auth_base_url = "https://oauth2.quran.foundation"
        self.api_base_url = "https://apis.quran.foundation"

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

            client_id = os.environ.get("QF_Prod_CLIENT_ID")
            client_secret = os.environ.get("QF_Prod_CLIENT_SECRET")
            if not client_id or not client_secret:
                raise ValueError(
                    "Server OAuth configuration is missing "
                    "(QF_Prod_CLIENT_ID or QF_Prod_CLIENT_SECRET)."
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

@router.get("/api/chapters")
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
    client_id = os.environ.get("QF_Prod_CLIENT_ID")
    if not client_id:
        raise HTTPException(
            status_code=500,
            detail="Server OAuth configuration is missing (QF_Prod_CLIENT_ID).",
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

@router.get("/content/api/v4/{path:path}")
async def proxy_content_api(path: str, request: Request):
    client_id = os.environ.get("QF_Prod_CLIENT_ID")
    if not client_id:
        raise HTTPException(
            status_code=500,
            detail="Server OAuth configuration is missing (QF_Prod_CLIENT_ID).",
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
