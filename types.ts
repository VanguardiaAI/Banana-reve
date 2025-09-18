

export interface ImageVariation {
  id: string;
  title: string;
  description: string;
  imageUrl: string; // base64 data URL
  createdAt: Date;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  retryPayload?: {
    // base64Data: string; <-- Replaced
    // mimeType: string; <-- Replaced
    images: { base64Data: string, mimeType: string }[];
    prompt: string;
  };
  objects?: DetectedObject[];
}

export interface GroundingChunk {
    web: {
        uri: string;
        title: string;
    }
}

export interface ChatMessage {
  id:string;
  role: 'user' | 'assistant';
  text?: string;
  imageUrls?: string[]; // The user's uploaded images (renamed from imageUrl)
  variations?: ImageVariation[]; // The assistant's generated images
  isLoading?: boolean;
  isError?: boolean;
  sourceImageUrl?: string; // The primary image used as the base for generation display
  followUpSuggestions?: string[]; // AI-generated follow-up prompts
  originalRequest?: { // For retrying failed requests
    prompt: string;
    imageFiles: File[]; // Changed from imageFile: File
    sourceImageUrl?: string;
    useWebSearch: boolean;
  };
  groundingMetadata?: {
    groundingChunks: GroundingChunk[];
  };
  statusMessage?: string; // For displaying messages like "Analyzing web results..."
}

export interface Album {
    id: string;
    title: string;
    chatHistory: ChatMessage[];
    galleryImages: ImageVariation[];
    createdAt: Date;
}

// Types for Object Detection/Segmentation
export interface BoundingBox {
  yMin: number;
  xMin: number;
  yMax: number;
  xMax: number;
}

export interface DetectedObject {
  id: string;
  label: string;
  box: BoundingBox;
  mask: string; // base64 encoded png mask
  children: DetectedObject[];
  thumbnailUrl?: string;
}

// Type for the raw API response for segmentation
export interface ApiObject {
  id:string;
  parentId: string | null;
  label: string;
  box_2d: [number, number, number, number]; // ymin, xmin, ymax, xmax (normalized 0-1000)
  mask?: string; // The mask is now optional, as it will be generated on the client.
}