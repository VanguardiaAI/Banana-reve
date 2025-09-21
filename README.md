# Banana Reve - Advanced AI Image Generation & Editing Platform

<div align="center">
<img width="1200" height="475" alt="Banana Reve Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

## Overview

Banana Reve is a sophisticated web application that leverages Google's Gemini AI models to provide advanced image generation and editing capabilities through both conversational and visual interfaces. The application combines state-of-the-art AI image generation with an object-based editor for precise image manipulation.

## Key Features

### 🎨 AI-Powered Image Generation
- **Multi-variant Generation**: Creates 3 unique variations from your prompts
- **Multilingual Web Search**: Searches for inspiration across multiple languages (English, Japanese, Korean)
- **Streaming Results**: Real-time generation with progress updates
- **Smart Prompt Engineering**: Automatically enhances prompts with professional photography terminology

### 🔧 Advanced Object Editor
- **Automatic Object Detection**: Hierarchical scene graph with parent-child relationships
- **Mask-Based Editing**: Precise edits to specific image regions
- **Visual Repositioning**: Move objects using intuitive drag-and-drop with visual instructions
- **Multi-level Selection**: Edit parent objects and all their children simultaneously

### 💾 Smart State Management
- **Album-Based Organization**: Group related images and conversations
- **Edit History**: Navigate through all editing states
- **Persistent Object Data**: Objects remain associated with images across sessions
- **Retry Mechanisms**: Failed generations can be retried with stored payloads

## Technical Architecture

### Frontend Stack
- **React 19.1.1** - Latest React with concurrent features
- **TypeScript 5.8.2** - Type-safe development
- **Vite 6.2.0** - Lightning-fast HMR and build tool
- **Tailwind CSS** - Utility-first styling

### AI Integration
- **Google Gemini AI Models**:
  - `gemini-2.5-flash` - Planning and analysis
  - `gemini-2.5-flash-image-preview` - Image generation and editing
- **Custom JSON Schema Validation** - Structured AI responses
- **Async Generators** - Streaming AI results

### Core Services

#### `geminiService.ts`
The heart of AI integration, providing:
- `generateImageEdits()` - Main async generator for image variations
- `segmentObjectsInImage()` - Object detection with bounding boxes
- `editImageWithMask()` - Localized image editing
- `generateRepositionPrompt()` - Visual-to-text instruction conversion
- `applyRepositionEdit()` - Object repositioning execution

## Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Gemini API key from Google AI Studio

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/banana-reve.git
   cd banana-reve
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   # Create .env.local file
   echo "GEMINI_API_KEY=your_api_key_here" > .env.local
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:5173
   ```

## Usage Guide

### Basic Workflow

1. **Create an Album**: Start with a new album to organize your work
2. **Upload Images**: Add one or more base images
3. **Generate Variations**: 
   - Enter a creative prompt
   - Enable web search for AI-powered inspiration
   - Review 3 generated variations
4. **Edit in Advanced Editor**:
   - Automatic object detection on image open
   - Select objects to edit specific areas
   - Reposition objects with drag-and-drop

### Advanced Features

#### Developer Mode
Access experimental features and view internal prompts:
- Enable via sidebar toggle
- Requires confirmation to prevent accidental activation
- Shows masks, prompts, and visual instructions

#### Multi-Image Remix
Combine multiple images:
```javascript
// The system analyzes all provided images
// Creates cohesive variations incorporating elements from each
```

#### Custom Positioning
1. Select and drag objects to new positions
2. System generates movement instructions
3. AI recomposites the image maintaining visual coherence

## API Reference

### Image Generation Flow
```typescript
async function* generateImageEdits(
  images: { base64Data: string, mimeType: string }[],
  userPrompt: string,
  useWebSearch: boolean = false
): AsyncGenerator<GeneratorYield>
```

### Object Detection
```typescript
segmentObjectsInImage(
  imageBase64: string,
  mimeType: string
): Promise<ApiObject[]>
```

### Masked Editing
```typescript
editImageWithMask(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  maskBase64: string
): Promise<string[]>
```

## Configuration

### Environment Variables
- `GEMINI_API_KEY` - Your Google AI API key

### Build Configuration
```javascript
// vite.config.ts
{
  define: {
    'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
  }
}
```

## Performance Optimizations

- **Lazy AI Client Initialization**: API client created on first use
- **Streaming Responses**: Results appear as generated
- **Smart Caching**: 15-minute cache for web fetches
- **Memory Management**: Automatic cleanup of object URLs

## Internationalization

Supports multiple languages:
- English (en)
- Korean (ko)

Language auto-detection based on browser settings.

## Security Considerations

- API keys stored in environment variables only
- Base64 image processing happens client-side
- No image data persisted to servers
- Validation of all AI-generated content

## Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Project Structure
```
banana-reve/
├── components/     # React components
├── services/       # API integrations
├── utils/          # Helper functions
├── types.ts        # TypeScript definitions
├── i18n.ts         # Internationalization
└── App.tsx         # Main application
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with Google's Gemini AI technology
- Inspired by professional photo editing workflows
- Community feedback and contributions

---

**Note**: This is an AI-powered application. Generated content quality depends on the Gemini API and may vary. Always review generated images before use in production contexts.