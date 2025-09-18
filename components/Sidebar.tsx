



import React from 'react';
import { t } from '../i18n';
import { HomeIcon } from './icons/HomeIcon';
import { NewAlbumIcon } from './icons/NewAlbumIcon';
import { EditSidebarIcon } from './icons/EditSidebarIcon';
import { DevModeIcon } from './icons/DevModeIcon';

interface SidebarProps {
  onNewAlbum: () => void;
  onGoHome: () => void;
  onGoToEditor: () => void;
  isDevMode: boolean;
  onToggleDevMode: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNewAlbum, onGoHome, onGoToEditor, isDevMode, onToggleDevMode }) => {
  return (
    <aside className="w-16 bg-[#0D0D0D] flex flex-col items-center py-4 space-y-6 flex-shrink-0 border-r border-white/10">
      <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center text-2xl font-bold text-black">
        B
      </div>
      <div className="flex flex-col items-center space-y-4">
        <button onClick={onGoHome} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg" aria-label={t('home')}>
          <HomeIcon />
        </button>
        <button onClick={onNewAlbum} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg" aria-label={t('newAlbum')}>
          <NewAlbumIcon />
        </button>
        <button onClick={onGoToEditor} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg" aria-label={t('editDirectly')}>
          <EditSidebarIcon />
        </button>
      </div>

      <div className="flex-1"></div>

      <div className="flex flex-col items-center space-y-4">
        <button 
            onClick={onToggleDevMode} 
            className={`p-2 rounded-lg transition-colors ${isDevMode ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
            aria-label={t('devMode')}
            title={t('devMode')}
        >
          <DevModeIcon />
        </button>
      </div>
    </aside>
  );
};