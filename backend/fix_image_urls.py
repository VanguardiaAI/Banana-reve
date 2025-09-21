import json
from pathlib import Path

ALBUMS_DB = Path("data/albums.json")

def fix_image_urls():
    """Fix image URLs to use absolute paths"""
    if not ALBUMS_DB.exists():
        print("No albums.json found")
        return
    
    with open(ALBUMS_DB, 'r') as f:
        albums = json.load(f)
    
    updated = False
    for album in albums:
        # Fix gallery images
        if 'galleryImages' in album:
            for image in album['galleryImages']:
                if 'imageUrl' in image and image['imageUrl'].startswith('/api/'):
                    old_url = image['imageUrl']
                    image['imageUrl'] = f"http://localhost:8001{old_url}"
                    print(f"Fixed: {old_url} -> {image['imageUrl']}")
                    updated = True
        
        # Fix images in chat history
        if 'chatHistory' in album:
            for message in album['chatHistory']:
                if 'imageUrls' in message and message['imageUrls']:
                    for i, url in enumerate(message['imageUrls']):
                        if url.startswith('/api/'):
                            message['imageUrls'][i] = f"http://localhost:8001{url}"
                            print(f"Fixed chat image: {url} -> {message['imageUrls'][i]}")
                            updated = True
                
                if 'variations' in message and message['variations']:
                    for variation in message['variations']:
                        if 'imageUrl' in variation and variation['imageUrl'].startswith('/api/'):
                            old_url = variation['imageUrl']
                            variation['imageUrl'] = f"http://localhost:8001{old_url}"
                            print(f"Fixed variation: {old_url} -> {variation['imageUrl']}")
                            updated = True
    
    if updated:
        with open(ALBUMS_DB, 'w') as f:
            json.dump(albums, f, indent=2)
        print("\nAll image URLs have been fixed!")
    else:
        print("No URLs needed fixing")

if __name__ == "__main__":
    fix_image_urls()