

import React, { useState, useEffect } from 'react';
import { t } from '../i18n';
import { Spinner } from './Spinner';

interface PromptData {
  prompt: string;
  imageFiles: File[];
  useWebSearch: boolean;
}

interface DevModeConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (updatedPrompt: string) => void;
  promptData: PromptData;
}

export const DevModeConfirmationModal: React.FC<DevModeConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  promptData,
}) => {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [editedPrompt, setEditedPrompt] = useState(promptData.prompt);

  useEffect(() => {
    if (isOpen && promptData.imageFiles.length > 0) {
      const urls = promptData.imageFiles.map(file => URL.createObjectURL(file));
      setImageUrls(urls);
      return () => urls.forEach(url => URL.revokeObjectURL(url));
    }
  }, [isOpen, promptData.imageFiles]);

  useEffect(() => {
    setEditedPrompt(promptData.prompt);
  }, [promptData.prompt]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#1C1C1E] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-4 border-b border-white/10 flex-shrink-0">
          <h2 className="text-lg font-bold text-white">{t('devModeConfirmTitle')}</h2>
        </header>
        <main className="flex-1 p-6 overflow-y-auto space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">{t('devModePromptLabel')}</label>
            <textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="w-full bg-[#131314] text-gray-200 p-3 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={6}
              placeholder="Enter your prompt here..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">{t('devModeImageLabel')} ({imageUrls.length})</label>
                <div className="flex flex-wrap gap-2">
                    {imageUrls.length > 0 ? (
                        imageUrls.map((url, index) => (
                           <img key={index} src={url} alt={`Preview ${index}`} className="rounded-lg max-h-32" />
                        ))
                    ) : (
                        <div className="h-32 bg-[#131314] rounded-lg flex items-center justify-center">
                            <Spinner />
                        </div>
                    )}
                </div>
            </div>
             <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">{t('devModeWebSearchLabel')}</label>
                <div className={`px-3 py-2 rounded-md text-sm font-semibold inline-block ${promptData.useWebSearch ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-700 text-gray-300'}`}>
                    {promptData.useWebSearch ? 'Enabled' : 'Disabled'}
                </div>
            </div>
          </div>
        </main>
        <footer className="p-4 border-t border-white/10 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="bg-[#2C2C2E] hover:bg-gray-700 text-white font-semibold px-5 py-2 rounded-lg">
            {t('devModeCancel')}
          </button>
          <button onClick={() => onConfirm(editedPrompt)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg">
            {t('devModeConfirm')}
          </button>
        </footer>
      </div>
    </div>
  );
};