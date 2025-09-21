import { Album, ImageVariation, ChatMessage } from '../types';

const API_URL = 'http://localhost:8001';

export const apiService = {
  // Albums
  async getAlbums(): Promise<Album[]> {
    console.log('Fetching albums from:', `${API_URL}/api/albums`);
    const response = await fetch(`${API_URL}/api/albums`);
    const data = await response.json();
    console.log('Albums loaded:', data);
    return data.map((album: any) => ({
      ...album,
      createdAt: new Date(album.createdAt),
      chatHistory: album.chatHistory || [],
      galleryImages: (album.galleryImages || []).map((img: any) => ({
        ...img,
        createdAt: new Date(img.createdAt)
      }))
    }));
  },

  async getAlbum(id: string): Promise<Album> {
    const response = await fetch(`${API_URL}/api/albums/${id}`);
    const data = await response.json();
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      chatHistory: data.chatHistory || [],
      galleryImages: (data.galleryImages || []).map((img: any) => ({
        ...img,
        createdAt: new Date(img.createdAt)
      }))
    };
  },

  async createAlbum(title: string): Promise<Album> {
    const response = await fetch(`${API_URL}/api/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    const data = await response.json();
    return {
      ...data,
      createdAt: new Date(data.createdAt)
    };
  },

  async updateAlbum(id: string, update: Partial<Album>): Promise<Album> {
    console.log('Updating album:', id, update);
    const response = await fetch(`${API_URL}/api/albums/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...update,
        createdAt: update.createdAt?.toISOString(),
        galleryImages: update.galleryImages?.map(img => ({
          ...img,
          createdAt: img.createdAt.toISOString()
        }))
      })
    });
    const data = await response.json();
    console.log('Album updated:', data);
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      chatHistory: data.chatHistory || [],
      galleryImages: (data.galleryImages || []).map((img: any) => ({
        ...img,
        createdAt: new Date(img.createdAt)
      }))
    };
  },

  async deleteAlbum(id: string): Promise<void> {
    await fetch(`${API_URL}/api/albums/${id}`, {
      method: 'DELETE'
    });
  },

  // Images
  async saveBase64Image(
    imageData: string,
    title: string,
    description: string,
    albumId?: string,
    objects?: any[]
  ): Promise<ImageVariation> {
    console.log('Saving base64 image with albumId:', albumId);
    const response = await fetch(`${API_URL}/api/images/base64`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageData,
        title,
        description,
        albumId,
        objects
      })
    });
    const data = await response.json();
    console.log('Image saved:', data);
    return {
      ...data,
      createdAt: new Date(data.createdAt)
    };
  },

  async uploadImage(
    file: File,
    title: string,
    description: string,
    albumId?: string
  ): Promise<ImageVariation> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('description', description);
    if (albumId) {
      formData.append('albumId', albumId);
    }

    const response = await fetch(`${API_URL}/api/images/upload`, {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    return {
      ...data,
      createdAt: new Date(data.createdAt)
    };
  },

  // Utility function to convert base64 to server URL
  async convertBase64ToUrl(base64Data: string): Promise<string> {
    const response = await fetch(`${API_URL}/api/images/base64`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageData: base64Data,
        title: 'temp',
        description: 'temp'
      })
    });
    const data = await response.json();
    return data.imageUrl;
  }
};