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
    title="Quran Guidance API",
    description="An API that returns a relevant Quranic verse based on user emotions or questions.",
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
    payload = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "client_secret": client_secret,
        "code": request.code,
        "code_verifier": request.code_verifier,
        "redirect_uri": request.redirect_uri
    }

    try:
        # Make a secure server-to-server request
        async with httpx.AsyncClient() as client:
            response = await client.post(token_url, data=payload)
            
            if response.status_code != 200:
                print("OAuth2 Error:", response.text)
                raise HTTPException(status_code=400, detail="Invalid authorization code or URI mismatch.")
            
            token_data = response.json()
            
            # Return the access_token and id_token to the React frontend
            return {
                "status": "success",
                "session": {
                    "access_token": token_data.get("access_token"),
                    "id_token": token_data.get("id_token"),
                    "expires_in": token_data.get("expires_in")
                }
            }
            
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Failed to communicate with Auth server: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)