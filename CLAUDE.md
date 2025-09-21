# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Banana Reve is an AI-powered image editing and generation application built with React, TypeScript, and Vite. It integrates with Google's Gemini AI API to provide advanced image manipulation capabilities.

## Essential Commands

**Development:**
```bash
npm install          # Install dependencies
npm run dev         # Start development server (Vite)
npm run build       # Build for production
npm run preview     # Preview production build
```

## Environment Setup

Before running the app, ensure the Gemini API key is configured:
- Set `GEMINI_API_KEY` in `.env.local`
- The API key is accessed via `process.env.API_KEY` in the code

## Architecture Overview

### Core Application Flow
1. **App.tsx** - Main component managing view state (dashboard/album/editor)
2. **Three primary views:**
   - Dashboard: Browse and select albums
   - Album: Chat interface with image generation history
   - Editor: Advanced image editing with object detection/manipulation

### Key Services
- **geminiService.ts** - All AI interactions:
  - `generateImageEdits()` - Async generator for creating image variations
  - `segmentObjectsInImage()` - Object detection with hierarchical scene graph
  - `editImageWithMask()` - Masked image editing
  - `applyRepositionEdit()` - Object repositioning with visual instructions

### State Management
- Album-based organization with chat history and gallery images
- No external state management library - uses React hooks
- Images stored as base64 data URLs

### Internationalization
- Supports English and Korean (via i18n.ts)
- Language detection and switching handled automatically

### Development Mode
- Special dev mode toggle in sidebar enables experimental features
- Dev mode confirmation modals prevent accidental activation

## Important Technical Details

1. **Image Handling**: All images are converted to base64 and stored in memory
2. **Async Generators**: Image generation uses async generators for streaming results
3. **Error Handling**: Failed image generations include retry payloads
4. **TypeScript Path Aliases**: Uses `@/` prefix for root directory imports
5. **Vite Configuration**: Custom environment variable handling for API keys