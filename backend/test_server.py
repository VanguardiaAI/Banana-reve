from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Test server is working"}

@app.get("/api/albums")
async def get_albums():
    return []

@app.post("/api/albums")
async def create_album(data: dict):
    return {
        "id": "test-123",
        "title": data.get("title", "Test Album"),
        "chatHistory": [],
        "galleryImages": [],
        "createdAt": "2024-01-01T00:00:00"
    }

if __name__ == "__main__":
    print("Starting test server on http://localhost:8000")
    uvicorn.run(app, host="127.0.0.1", port=8001)