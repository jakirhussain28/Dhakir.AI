import os
import re
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
import httpx
from dotenv import load_dotenv
import copy

load_dotenv()
app = FastAPI()

origins = [
    "https://alquran-furqan.vercel.app",
    "https://alquran-foundation.vercel.app",
    "https://quran-furqan.vercel.app",
    "http://localhost:5009",
    "http://192.168.1.2:5009"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_URL = "https://api.quran.com/api/v4"
SERVER_CACHE = {}

async def make_request(endpoint: str, params: dict = {}):
    # generate id
    param_key = str(sorted(params.items()))
    cache_key = f"{endpoint}::{param_key}"

    # 1. CHECK RAM
    if cache_key in SERVER_CACHE:
        print(f"[LOG] Serving from RAM Cache: {cache_key}")
        return SERVER_CACHE[cache_key]

    # 2. FETCH ONLINE
    print(f"[LOG] Fetching external: {endpoint}")
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE_URL}{endpoint}", params=params)
        
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        
        data = resp.json()
        
        # 3. SAVE RAM
        SERVER_CACHE[cache_key] = data
        return data

# API ROUTES

@app.get("/api")
async def api_root():
    return {"status": "ok", "message": "Quran API ready"}

# GET CHAPTERS
@app.get("/api/chapters")
async def get_chapters(response: Response):
    # cache 365days
    response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return await make_request("/chapters")

# GET INFO
@app.get("/api/chapters/{chapter_id}/info")
async def get_chapter_info(chapter_id: int, response: Response):
    response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return await make_request(f"/chapters/{chapter_id}/info", {"language": "en"})

# GET VERSES
@app.get("/api/chapters/{chapter_id}/verses")
async def get_verses(chapter_id: int, response: Response, page: int = 1):
    response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    
    # check processed cache
    processed_cache_key = f"processed_verses::{chapter_id}::{page}"
    if processed_cache_key in SERVER_CACHE:
        print(f"[LOG] Serving Processed Verses from RAM: {processed_cache_key}")
        return SERVER_CACHE[processed_cache_key]

    params = {
        "language": "en",
        "words": "false",
        "translations": "20,57",   # ID 57 is Complex English Transliteration
        "audio": "7",           # mishari rashid al-afasy
        "fields": "text_uthmani",
        "page": page,
        "per_page": 10
    }
    
    # 1. GET RAW DATA
    data = await make_request(f"/verses/by_chapter/{chapter_id}", params)
    
    # 2. CLEAN DATA
    clean_data = copy.deepcopy(data) # safe copy

    if "verses" in clean_data:
        for verse in clean_data["verses"]:
            
            if "text_uthmani" in verse:
                # replace standard sukun (0652) with quranic sukun (06e1)
                verse["text_uthmani"] = verse["text_uthmani"].replace("\u0652", "\u06e1")
                
                # then replace small high rounded zero (06df) with standard sukun (0652)
                verse["text_uthmani"] = verse["text_uthmani"].replace("\u06df", "\u0652")

            if "translations" in verse:
                for translation in verse["translations"]:
                    original_text = translation["text"]
                    
                    # remove footnotes
                    text_no_tags = re.sub(r'<sup\b[^>]*>[\s\S]*?</sup>', '', original_text)
                    
                    # fix spacing
                    clean_text = re.sub(r'\s+', ' ', text_no_tags).strip()
                    translation["text"] = clean_text
    
    # 3. SAVE PROCESSED
    SERVER_CACHE[processed_cache_key] = clean_data
    
    return clean_data