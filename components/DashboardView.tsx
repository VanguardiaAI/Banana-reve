
import React, { useState } from 'react';
import { t } from '../i18n';
import type { Album } from '../types';

interface DashboardViewProps {
  albums: Album[];
  onSelectAlbum: (albumId: string) => void;
  onNewAlbum: () => void;
  onDeleteAlbum: (albumId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ albums, onSelectAlbum, onNewAlbum, onDeleteAlbum }) => {
  const [activeTab, setActiveTab] = useState<'albums' | 'inspiration'>('albums');
  
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  return (
    <div className="p-8 h-full bg-[#131314]">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">{t('appName')}</h1>
      </header>
      
      <div className="mb-6 border-b border-gray-700/50">
        <nav className="-mb-px flex space-x-6">
          <button 
            onClick={() => setActiveTab('albums')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'albums' ? 'border-white text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
          >
            {t('myAlbums')}
          </button>
          <button
            onClick={() => setActiveTab('inspiration')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'inspiration' ? 'border-white text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
          >
            {t('inspiration')}
          </button>
        </nav>
      </div>

      <div>
        {activeTab === 'albums' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            <button 
              onClick={onNewAlbum}
              className="flex flex-col items-center justify-center bg-[#212124] rounded-lg aspect-square hover:bg-gray-800 transition-colors text-gray-400"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <span className="mt-2 text-sm font-medium">{t('newAlbum')}</span>
            </button>
            {albums.map(album => {
              const previewImages = album.galleryImages.slice(0, 4);
              const hasImages = previewImages.length > 0;
              
              return (
                <div key={album.id} className="cursor-pointer group relative">
                  <div onClick={() => onSelectAlbum(album.id)} className="bg-[#212124] rounded-lg aspect-square mb-2 group-hover:ring-2 ring-blue-500 transition-all overflow-hidden relative">
                    {hasImages ? (
                      <div className={`grid h-full ${previewImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-0.5`}>
                        {previewImages.map((image, index) => (
                          <div key={image.id} className={`relative overflow-hidden ${previewImages.length === 3 && index === 0 ? 'col-span-2' : ''}`}>
                            <img 
                              src={image.imageUrl} 
                              alt={image.title} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                console.error('Failed to load image:', image.imageUrl);
                                e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjMjEyMTI0Ii8+CjxwYXRoIGQ9Ik0xMDAgNjBDNzcuOTA4NiA2MCA2MCA3Ny45MDg2IDYwIDEwMEM2MCAxMjIuMDkxIDc3LjkwODYgMTQwIDEwMCAxNDBDMTIyLjA5MSAxNDAgMTQwIDEyMi4wOTEgMTQwIDEwMEMxNDAgNzcuOTA4NiAxMjIuMDkxIDYwIDEwMCA2MFoiIHN0cm9rZT0iIzNGM0Y0NiIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGQ9Ik04NSA4NUw5NSA5NU04NSA5NUw5NSA4NU0xMDUgODVMMTE1IDk1TTEwNSA5NUwxMTUgODVNODUgMTA1QzgwIDExNSAxMjAgMTE1IDExNSAxMDUiIHN0cm9rZT0iIzNGM0Y0NiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPC9zdmc+';
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                      </div>
                    )}
                    {previewImages.length > 4 && (
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        +{album.galleryImages.length - 4}
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`¿Eliminar "${album.title}"?`)) {
                          onDeleteAlbum(album.id);
                        }
                      }}
                      className="absolute top-2 right-2 bg-black/70 hover:bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                  <h3 className="font-medium text-white truncate">{album.title}</h3>
                  <p className="text-xs text-gray-400">{formatDate(album.createdAt)}</p>
                </div>
              );
            })}
          </div>
        )}
        {activeTab === 'inspiration' && (
           <p className="text-gray-400">Inspiration content coming soon.</p>
        )}
      </div>
    </div>
  );
};
