

import React, { useState, useRef, useEffect } from 'react';
import { t } from '../i18n';
import { WebSearchToggle } from './WebSearchToggle';

interface ChatInputProps {
  onSend: (prompt: string, imageFiles: File[], useWebSearch: boolean, sourceImageUrl?: string) => void;
  prefilledImage?: File | null;
  prefilledPrompt?: string;
  onPrefillConsumed?: () => void;
  isDisabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  prefilledImage,
  prefilledPrompt,
  onPrefillConsumed,
  isDisabled = false,
}) => {
  const [prompt, setPrompt] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const consumedRef = useRef({ image: false, prompt: false });

  useEffect(() => {
    // This effect handles adding a single prefilled image from the gallery
    if (prefilledImage && !consumedRef.current.image) {
      const newFiles = [...imageFiles, prefilledImage];
      setImageFiles(newFiles);
      const newUrls = [...imageUrls, URL.createObjectURL(prefilledImage)];
      setImageUrls(newUrls);
      consumedRef.current.image = true;
      onPrefillConsumed?.();
    }
    // Clean up URLs when component unmounts or files change
    return () => {
      imageUrls.forEach(URL.revokeObjectURL);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledImage, onPrefillConsumed]);

  useEffect(() => {
    if (prefilledPrompt && !consumedRef.current.prompt) {
      setPrompt(prefilledPrompt);
      consumedRef.current.prompt = true;
      onPrefillConsumed?.();
    }
  }, [prefilledPrompt, onPrefillConsumed]);

  useEffect(() => {
    // This effect is to handle the case where the parent component might reset the prefills
    if (!prefilledImage) {
        consumedRef.current.image = false;
    }
    if (!prefilledPrompt) {
        consumedRef.current.prompt = false;
    }
  }, [prefilledImage, prefilledPrompt]);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const newFiles = [...imageFiles, ...files];
      setImageFiles(newFiles);

      const newUrls = files.map(file => URL.createObjectURL(file));
      setImageUrls(prev => [...prev, ...newUrls]);
    }
  };

  const handleSend = () => {
    if (prompt.trim() && onSend) {
      onSend(prompt.trim(), imageFiles, useWebSearch);
      setPrompt('');
      setImageFiles([]);
      setImageUrls([]);
      if(fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      consumedRef.current = { image: false, prompt: false };
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };
  
  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImageUrls(prev => {
        URL.revokeObjectURL(prev[index]);
        return prev.filter((_, i) => i !== index);
    });
  }

  return (
    <div className="bg-[#1C1C1E] rounded-2xl flex items-start p-2.5 shadow-lg w-full">
      <div className="flex-1 flex flex-col">
        {imageFiles.length > 0 && (
          <div className="flex items-center flex-wrap gap-2 mb-2 px-1">
            {imageUrls.map((url, index) => (
              <div key={index} className="relative">
                <img src={url} alt={`Upload preview ${index + 1}`} className="w-12 h-12 rounded-lg object-cover" />
                <button 
                  onClick={() => removeImage(index)}
                  className="absolute -top-1.5 -right-1.5 bg-gray-800 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold border-2 border-[#1C1C1E] hover:bg-red-500"
                  aria-label={`Remove image ${index + 1}`}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('chatPlaceholder')}
          className="bg-transparent text-white placeholder-gray-500 focus:outline-none text-base w-full px-1"
          disabled={isDisabled}
        />
      </div>
      <div className="flex items-center self-end">
        <WebSearchToggle isEnabled={useWebSearch} onToggle={setUseWebSearch} />
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/png, image/jpeg, image/webp"
          multiple // Allow multiple file selection
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-gray-400 hover:text-white"
          disabled={isDisabled}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button
          onClick={handleSend}
          disabled={!prompt.trim() || isDisabled}
          className="p-2 rounded-full bg-gray-700 text-white disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="19" x2="12" y2="5"></line>
            <polyline points="5 12 12 5 19 12"></polyline>
          </svg>
        </button>
      </div>
    </div>
  );
};