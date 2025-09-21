from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
import shutil
import uuid
import json
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI()

# Configure CORS - MUST be before routes
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "*"  # Allow all origins for development
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Create directories
UPLOAD_DIR = Path("uploads")
ALBUMS_DB = Path("data/albums.json")

UPLOAD_DIR.mkdir(exist_ok=True)
ALBUMS_DB.parent.mkdir(exist_ok=True)

if not ALBUMS_DB.exists():
    ALBUMS_DB.write_text("[]")


# Pydantic models
class ImageVariationCreate(BaseModel):
    title: str
    description: str
    albumId: Optional[str] = None
    objects: Optional[List[dict]] = None


class ImageVariationResponse(BaseModel):
    id: str
    title: str
    description: str
    imageUrl: str
    createdAt: datetime
    objects: Optional[List[dict]] = None


class ChatMessageCreate(BaseModel):
    role: str
    text: Optional[str] = None
    imageUrls: Optional[List[str]] = None
    variations: Optional[List[dict]] = None
    sourceImageUrl: Optional[str] = None
    followUpSuggestions: Optional[List[str]] = None
    groundingMetadata: Optional[dict] = None


class AlbumCreate(BaseModel):
    title: str


class AlbumUpdate(BaseModel):
    title: Optional[str] = None
    chatHistory: Optional[List[dict]] = None
    galleryImages: Optional[List[dict]] = None


# Helper functions
def load_albums():
    try:
        with open(ALBUMS_DB, 'r') as f:
            return json.load(f)
    except:
        return []


def save_albums(albums):
    with open(ALBUMS_DB, 'w') as f:
        json.dump(albums, f, indent=2, default=str)


# Routes
@app.get("/")
async def root():
    logger.info("Root endpoint called")
    return {"message": "Banana Reve Backend is running", "status": "ok"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "albums_count": len(load_albums())}


@app.get("/api/albums")
async def get_albums():
    logger.info("GET /api/albums called")
    try:
        albums = load_albums()
        logger.info(f"Returning {len(albums)} albums")
        return albums
    except Exception as e:
        logger.error(f"Error getting albums: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/albums")
async def create_album(album: AlbumCreate):
    logger.info(f"Creating album: {album.title}")
    try:
        album_id = str(uuid.uuid4())
        new_album = {
            "id": album_id,
            "title": album.title,
            "chatHistory": [],
            "galleryImages": [],
            "createdAt": datetime.now().isoformat()
        }
        
        albums = load_albums()
        albums.append(new_album)
        save_albums(albums)
        
        logger.info(f"Album created: {album_id}")
        return new_album
    except Exception as e:
        logger.error(f"Error creating album: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/albums/{album_id}")
async def get_album(album_id: str):
    logger.info(f"Getting album: {album_id}")
    albums = load_albums()
    for album in albums:
        if album["id"] == album_id:
            return album
    raise HTTPException(status_code=404, detail="Album not found")


@app.put("/api/albums/{album_id}")
async def update_album(album_id: str, album_update: AlbumUpdate):
    logger.info(f"Updating album: {album_id}")
    try:
        albums = load_albums()
        for i, album in enumerate(albums):
            if album["id"] == album_id:
                update_data = album_update.dict(exclude_unset=True)
                albums[i].update(update_data)
                save_albums(albums)
                logger.info(f"Album updated: {album_id}")
                return albums[i]
        raise HTTPException(status_code=404, detail="Album not found")
    except Exception as e:
        logger.error(f"Error updating album: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/albums/{album_id}")
async def delete_album(album_id: str):
    logger.info(f"Deleting album: {album_id}")
    albums = load_albums()
    albums = [a for a in albums if a["id"] != album_id]
    save_albums(albums)
    return {"message": "Album deleted"}


@app.post("/api/images/upload")
async def upload_image(
    file: UploadFile = File(...),
    title: str = "",
    description: str = "",
    albumId: Optional[str] = None
):
    logger.info(f"Uploading image: {file.filename} to album: {albumId}")
    try:
        file_id = str(uuid.uuid4())
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'png'
        file_name = f"{file_id}.{file_extension}"
        file_path = UPLOAD_DIR / file_name
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        image_data = {
            "id": file_id,
            "title": title or file.filename,
            "description": description,
            "imageUrl": f"http://localhost:8001/api/images/{file_name}",
            "createdAt": datetime.now().isoformat(),
            "filename": file_name
        }
        
        if albumId:
            albums = load_albums()
            for album in albums:
                if album["id"] == albumId:
                    if "galleryImages" not in album:
                        album["galleryImages"] = []
                    album["galleryImages"].append(image_data)
                    save_albums(albums)
                    break
        
        logger.info(f"Image uploaded: {file_id}")
        return image_data
    except Exception as e:
        logger.error(f"Error uploading image: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/images/{filename}")
async def get_image(filename: str):
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Add CORS headers to the response
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
    }
    
    return FileResponse(file_path, headers=headers)


@app.post("/api/images/base64")
async def save_base64_image(data: dict):
    """Save a base64 image and return its URL"""
    logger.info(f"Saving base64 image to album: {data.get('albumId')}")
    try:
        base64_data = data.get("imageData", "")
        title = data.get("title", "")
        description = data.get("description", "")
        albumId = data.get("albumId")
        objects = data.get("objects")
        
        if not base64_data:
            raise HTTPException(status_code=400, detail="No image data provided")
        
        # Remove the data URL prefix if present
        if "," in base64_data:
            base64_data = base64_data.split(",")[1]
        
        # Decode base64 to bytes
        import base64
        image_bytes = base64.b64decode(base64_data)
        
        # Save to file
        file_id = str(uuid.uuid4())
        file_name = f"{file_id}.png"
        file_path = UPLOAD_DIR / file_name
        
        with open(file_path, "wb") as f:
            f.write(image_bytes)
        
        image_data = {
            "id": file_id,
            "title": title,
            "description": description,
            "imageUrl": f"http://localhost:8001/api/images/{file_name}",
            "createdAt": datetime.now().isoformat(),
            "filename": file_name
        }
        
        if objects:
            image_data["objects"] = objects
        
        if albumId:
            albums = load_albums()
            for album in albums:
                if album["id"] == albumId:
                    if "galleryImages" not in album:
                        album["galleryImages"] = []
                    album["galleryImages"].append(image_data)
                    save_albums(albums)
                    break
        
        logger.info(f"Base64 image saved: {file_id}")
        return image_data
    except Exception as e:
        logger.error(f"Error saving base64 image: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Banana Reve Backend...")
    uvicorn.run(app, host="127.0.0.1", port=8001)