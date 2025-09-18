
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { DashboardView } from './components/DashboardView';
import { AlbumView } from './components/AlbumView';
import { EditorView } from './components/EditorView';
import { Sidebar } from './components/Sidebar';
import type { Album, ImageVariation } from './types';

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'album' | 'editor'>('dashboard');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  const [imageToEdit, setImageToEdit] = useState<ImageVariation | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDevMode, setIsDevMode] = useState(false);

  const activeAlbum = albums.find(a => a.id === activeAlbumId);

  const handleCreateNewAlbum = useCallback((switchToNew = true) => {
    const newAlbum: Album = {
      id: Date.now().toString(),
      title: `Album ${albums.length + 1}`,
      chatHistory: [],
      galleryImages: [],
      createdAt: new Date(),
    };
    setAlbums(prev => [...prev, newAlbum]);
    if (switchToNew) {
      setActiveAlbumId(newAlbum.id);
      setView('album');
    }
    return newAlbum;
  }, [albums.length]);

  // Effect to handle initial app load
  useEffect(() => {
    // This runs only once on initial mount
    if (albums.length === 0) {
      const initialAlbum = handleCreateNewAlbum(false); // Create but don't switch view yet
      setActiveAlbumId(initialAlbum.id);
      setView('album');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once

  const handleSelectAlbum = (albumId: string) => {
    setActiveAlbumId(albumId);
    setView('album');
  };

  const updateAlbum = (updatedAlbum: Album) => {
    setAlbums(prev => prev.map(a => a.id === updatedAlbum.id ? updatedAlbum : a));
  };
  
  const handleGoToEditor = (image: ImageVariation) => {
    setImageToEdit(image);
    setView('editor');
  };

  const handleGoToEditorDirectly = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelectedForEditing = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      const tempImage: ImageVariation = {
        id: `direct-edit-${Date.now()}`,
        title: file.name,
        description: 'Directly uploaded for editing',
        imageUrl: imageUrl,
        createdAt: new Date(),
      };
      setImageToEdit(tempImage);
      setView('editor');
    };
    reader.readAsDataURL(file);
    
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleReturnFromEditor = (newImage?: ImageVariation) => {
    const wasDirectEdit = imageToEdit?.id.startsWith('direct-edit-');
    
    if (newImage && activeAlbum) {
      const updatedAlbum = {
        ...activeAlbum,
        galleryImages: [...activeAlbum.galleryImages, newImage]
      };
      updateAlbum(updatedAlbum);
    }
    setImageToEdit(null);
    
    if (wasDirectEdit) {
        handleGoHome();
    } else {
        setView('album');
    }
  };
  
  const handleGoHome = () => {
    // Don't reset activeAlbumId, so we can return to it later
    setView('dashboard');
  }

  const renderView = () => {
    switch (view) {
      case 'editor':
        if (!imageToEdit) {
          setView('album'); 
          return null;
        }
        return <EditorView image={imageToEdit} onDone={handleReturnFromEditor} isDevMode={isDevMode} />;
      case 'album':
        if (!activeAlbum) {
          // If for some reason there's no active album, go back to dashboard
          // This also handles the initial render before the useEffect kicks in
          setView('dashboard');
          return null;
        }
        return <AlbumView album={activeAlbum} onUpdateAlbum={updateAlbum} onEditImage={handleGoToEditor} isDevMode={isDevMode} />;
      case 'dashboard':
      default:
        return <DashboardView albums={albums} onSelectAlbum={handleSelectAlbum} onNewAlbum={() => handleCreateNewAlbum(true)} />;
    }
  };

  return (
    <div className="h-screen bg-[#0D0D0D] text-gray-200 flex">
      <Sidebar 
        onNewAlbum={() => handleCreateNewAlbum(true)} 
        onGoHome={handleGoHome} 
        onGoToEditor={handleGoToEditorDirectly}
        isDevMode={isDevMode}
        onToggleDevMode={() => setIsDevMode(prev => !prev)}
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelectedForEditing}
        className="hidden"
        accept="image/png, image/jpeg, image/webp"
      />
      <div className="flex-1 h-full overflow-y-auto">
        {renderView()}
      </div>
    </div>
  );
};

export default App;