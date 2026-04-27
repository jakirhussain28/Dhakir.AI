from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import json

# Import your function
from Quran_Guide import generate_quran_guidance

app = FastAPI(
    title="Quran Guidance API",
    description="An API that returns a relevant Quranic verse based on user emotions or questions.",
    version="1.0.0"
)

origins = [
    "http://localhost:5010",
    "http://192.168.1.2:5010"
]

# Add CORS Middleware to allow requests from your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)

# Define the request body structure
class GuidanceRequest(BaseModel):
    user_input: str

@app.get("/")   #check
async def health_check():
    return "Health check is successfull"

@app.post("/api/guidance")
async def get_guidance(request: GuidanceRequest):
    try:
        # Call the imported function (which now returns a dictionary)
        response_data = generate_quran_guidance(request.user_input)
        
        # If the response somehow still returns as a JSON string, parse it
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

if __name__ == "__main__":
    # Run the server on port 8000
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)