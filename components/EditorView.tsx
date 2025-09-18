

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ImageVariation, ApiObject, DetectedObject, BoundingBox } from '../types';
import { segmentObjectsInImage, editImageWithMask, generateRepositionPrompt, applyRepositionEdit } from '../services/geminiService';
import { t } from '../i18n';
import { ObjectLayer } from './ObjectLayer';
import { ObjectLayerSkeleton } from './ObjectLayerSkeleton';
import { Spinner } from './Spinner';
import { InteractiveBoundingBox } from './InteractiveBoundingBox';
import { cropImage, createMaskFromBox, drawMovementInstructions } from '../utils/imageUtils';
import { StaticBoundingBox } from './StaticBoundingBox';
import { RedetectIcon } from './icons/RedetectIcon';
import { EditorDevModeConfirmationModal } from './EditorDevModeConfirmationModal';
import { EditorVariationSelector } from './EditorVariationSelector';

interface EditorViewProps {
  image: ImageVariation;
  onDone: (newImage?: ImageVariation) => void;
  isDevMode: boolean;
}

// Represents a snapshot of the editor's state for the history feature
interface EditorState {
  image: ImageVariation;
  objects: DetectedObject[];
  modifiedBoxes: Record<string, BoundingBox>;
}

interface EditorDevModalState {
  isOpen: boolean;
  data: {
    title: string;
    prompt: string;
    images: { title: string; url: string }[];
  } | null;
  onConfirm: () => void;
}

const findObjectById = (nodes: DetectedObject[], id: string): DetectedObject | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findObjectById(node.children, id);
    if (found) return found;
  }
  return null;
};

const getAllChildObjects = (object: DetectedObject): DetectedObject[] => {
    let children = [...object.children];
    object.children.forEach(child => {
        children = [...children, ...getAllChildObjects(child)];
    });
    return children;
};

const getAllObjects = (nodes: DetectedObject[]): DetectedObject[] => {
    let flat: DetectedObject[] = [];
    for (const node of nodes) {
        flat.push(node);
        if (node.children && node.children.length > 0) {
            flat = flat.concat(getAllObjects(node.children));
        }
    }
    return flat;
};

export const EditorView: React.FC<EditorViewProps> = ({ image, onDone, isDevMode }) => {
  const [objects, setObjects] = useState<DetectedObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // For initial object detection
  const [error, setError] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState({ width: 1, height: 1 });
  const [prompt, setPrompt] = useState('');
  
  const [expandedObjectIds, setExpandedObjectIds] = useState<Set<string>>(new Set());
  
  const [modifiedBoxes, setModifiedBoxes] = useState<Record<string, BoundingBox>>({});
  const [interactiveBox, setInteractiveBox] = useState<{x:number, y:number, width:number, height:number} | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLayout, setImageLayout] = useState({ top: 0, left: 0, width: 1, height: 1 });

  const [history, setHistory] = useState<EditorState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentImage, setCurrentImage] = useState(image);
  
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating' | 'analyzing'>('idle');
  const [variationsToSelect, setVariationsToSelect] = useState<ImageVariation[] | null>(null);
  
  const [devModalState, setDevModalState] = useState<EditorDevModalState>({
    isOpen: false,
    data: null,
    onConfirm: () => {},
  });


  const selectedObject = selectedObjectId ? findObjectById(objects, selectedObjectId) : null;
  const childObjectsOfSelected = selectedObject ? getAllChildObjects(selectedObject) : [];

  const movedObjects = useMemo(() => {
    if (objects.length === 0) return [];
    const allFlatObjects = getAllObjects(objects);
    return allFlatObjects.filter(obj => {
        const originalBox = obj.box;
        const modifiedBox = modifiedBoxes[obj.id];
        if (!modifiedBox) return false;
        const tolerance = 0.1; 
        return (
            Math.abs(originalBox.xMin - modifiedBox.xMin) > tolerance ||
            Math.abs(originalBox.yMin - modifiedBox.yMin) > tolerance ||
            Math.abs(originalBox.xMax - modifiedBox.xMax) > tolerance ||
            Math.abs(originalBox.yMax - modifiedBox.yMax) > tolerance
        );
    });
  }, [objects, modifiedBoxes]);

  const processApiObjects = useCallback(async (
    apiObjects: ApiObject[], 
    imageEl: HTMLImageElement
  ): Promise<DetectedObject[]> => {
    const originalIdToNewObjectMap = new Map<string, DetectedObject>();
    const allNewObjects = await Promise.all(
        apiObjects.map(async (item, i) => {
            const uniqueId = `client-${item.label.replace(/\s/g, '-')}-${i}-${Math.random()}`;
            const box: BoundingBox = {
                yMin: item.box_2d[0], xMin: item.box_2d[1],
                yMax: item.box_2d[2], xMax: item.box_2d[3],
            };
            const mask = createMaskFromBox(box, imageEl.naturalWidth, imageEl.naturalHeight);
            const newObject: DetectedObject & { _originalParentId?: string | null } = {
                id: uniqueId, label: item.label, box: box, mask: mask, children: [],
                thumbnailUrl: cropImage(imageEl, box), _originalParentId: item.parentId,
            };
            if (item.id) {
                originalIdToNewObjectMap.set(item.id, newObject);
            }
            return newObject;
        })
    );
    const roots: DetectedObject[] = [];
    for (const newObject of allNewObjects) {
      const parentId = newObject._originalParentId;
      if (parentId && originalIdToNewObjectMap.has(parentId)) {
        const parentObject = originalIdToNewObjectMap.get(parentId);
        if (parentObject && parentObject.id !== newObject.id) {
           parentObject.children.push(newObject);
        } else {
           roots.push(newObject);
        }
      } else {
        roots.push(newObject);
      }
      delete newObject._originalParentId;
    }
    const childIds = new Set(roots.flatMap(r => r.children.map(c => c.id)));
    return roots.filter(r => !childIds.has(r.id));
  }, []);

  const calculateLayout = useCallback(() => {
    if (imageRef.current && imageContainerRef.current) {
        const img = imageRef.current;
        const container = imageContainerRef.current;
        const containerW = container.clientWidth;
        const containerH = container.clientHeight;
        if (img.naturalWidth === 0) return;
        const imageW = img.naturalWidth;
        const imageH = img.naturalHeight;
        const containerAspect = containerW / containerH;
        const imageAspect = imageW / imageH;
        let renderedW, renderedH, renderedTop, renderedLeft;
        if (imageAspect > containerAspect) {
            renderedW = containerW;
            renderedH = renderedW / imageAspect;
            renderedTop = (containerH - renderedH) / 2;
            renderedLeft = 0;
        } else {
            renderedH = containerH;
            renderedW = renderedH * imageAspect;
            renderedLeft = (containerW - renderedW) / 2;
            renderedTop = 0;
        }
        setImageLayout({ top: renderedTop, left: renderedLeft, width: renderedW, height: renderedH });
    }
  }, []);
  
  const runObjectDetection = useCallback(async (imageToAnalyze: ImageVariation, historyIndexToUpdate: number) => {
    if (imageToAnalyze.objects && imageToAnalyze.objects.length > 0) {
        setObjects(imageToAnalyze.objects);
        setIsLoading(false);
        setGenerationStatus('idle');
        return;
    }
      
    const img = imageRef.current;
    if (!img) return;
    
    if (!img.complete || img.naturalHeight === 0) {
      await new Promise(resolve => { img.onload = resolve; });
    }

    setIsLoading(true);
    setError(null);
    if (historyIndexToUpdate === -1) {
        setObjects([]);
        setSelectedObjectId(null);
    }
    
    try {
      setImgSize({ width: img.naturalWidth, height: img.naturalHeight });
      calculateLayout();
      const base64Data = imageToAnalyze.imageUrl.split(',')[1];
      const mimeType = imageToAnalyze.imageUrl.match(/data:(.*);/)?.[1] || 'image/png';
      
      const apiObjects = await segmentObjectsInImage(base64Data, mimeType);
      const objectTree = await processApiObjects(apiObjects, img);
      
      setObjects(objectTree);

      // Update history with the new objects
      setHistory(prevHistory => {
        const newHistory = [...prevHistory];
        if (newHistory[historyIndexToUpdate]) {
            newHistory[historyIndexToUpdate] = { ...newHistory[historyIndexToUpdate], objects: objectTree };
        }
        return newHistory;
      });
      
      const rootIdsWithChildren = new Set(objectTree.filter(o => o.children.length > 0).map(obj => obj.id));
      setExpandedObjectIds(rootIdsWithChildren);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to segment image.');
    } finally {
      setIsLoading(false);
      setGenerationStatus('idle');
    }
  }, [calculateLayout, processApiObjects]);

  const addNewStateToHistory = useCallback((newImage: ImageVariation) => {
    // A placeholder entry is added, analysis will populate `objects` later.
    const newEntry: EditorState = { image: newImage, objects: [], modifiedBoxes: {} };
    // If we are branching from an earlier point in history, truncate the future.
    const newHistory = [...history.slice(0, historyIndex + 1), newEntry];
    const newIndex = newHistory.length - 1;
    setHistory(newHistory);
    setHistoryIndex(newIndex);
    // This is the key: set current image which triggers the useEffect for analysis.
    setCurrentImage(newImage); 
  }, [history, historyIndex]);

  useEffect(() => {
    // Only run analysis if the current image in history doesn't have objects yet.
    if (history[historyIndex] && history[historyIndex].objects.length === 0) {
      runObjectDetection(currentImage, historyIndex);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentImage, historyIndex, history]);
  
  // Initial analysis for the very first image
  useEffect(() => {
      addNewStateToHistory(image);
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  const handleBoxUpdate = useCallback((newPixelBox: {x:number, y:number, width:number, height:number}) => {
    setInteractiveBox(newPixelBox);
    if (selectedObjectId && imageLayout.width > 1 && imageLayout.height > 1) {
      const normalizedBox: BoundingBox = {
        xMin: Math.max(0, ((newPixelBox.x - imageLayout.left) / imageLayout.width) * 1000),
        yMin: Math.max(0, ((newPixelBox.y - imageLayout.top) / imageLayout.height) * 1000),
        xMax: Math.min(1000, ((newPixelBox.x + newPixelBox.width - imageLayout.left) / imageLayout.width) * 1000),
        yMax: Math.min(1000, ((newPixelBox.y + newPixelBox.height - imageLayout.top) / imageLayout.height) * 1000),
      };
      setModifiedBoxes(prev => ({ ...prev, [selectedObjectId]: normalizedBox }));
    }
  }, [selectedObjectId, imageLayout]);

  useEffect(() => {
    if (selectedObject && selectedObjectId) {
      const boxToUse = modifiedBoxes[selectedObjectId] || selectedObject.box;
      const { xMin, yMin, xMax, yMax } = boxToUse;
      setInteractiveBox({
          x: (xMin / 1000) * imageLayout.width + imageLayout.left,
          y: (yMin / 1000) * imageLayout.height + imageLayout.top,
          width: ((xMax - xMin) / 1000) * imageLayout.width,
          height: ((yMax - yMin) / 1000) * imageLayout.height
      });
    } else {
        setInteractiveBox(null);
    }
  }, [selectedObjectId, selectedObject, imageLayout, modifiedBoxes]);

  useEffect(() => {
    const observer = new ResizeObserver(() => calculateLayout());
    const container = imageContainerRef.current;
    if (container) observer.observe(container);
    return () => { if (container) observer.unobserve(container); };
  }, [calculateLayout]);
  
  const handleGenerateEdit = async () => {
    if (!prompt || !selectedObject) return;

    const execute = async () => {
        setGenerationStatus('generating');
        setError(null);
        try {
            const boxToUse = modifiedBoxes[selectedObject.id] || selectedObject.box;
            const maskBase64 = createMaskFromBox(boxToUse, imgSize.width, imgSize.height);
            const base64Data = currentImage.imageUrl.split(',')[1];
            const mimeType = currentImage.imageUrl.match(/data:(.*);/)?.[1] || 'image/png';
            const newImageBase64Array = await editImageWithMask(base64Data, mimeType, prompt, maskBase64);
            
            const newVariations = newImageBase64Array.map((b64, i) => ({
              id: `edited-${Date.now()}-${i}`,
              title: `Variation ${i + 1}`,
              description: `Result of: "${prompt}"`,
              imageUrl: `data:${mimeType};base64,${b64}`,
              createdAt: new Date(),
            }));

            setVariationsToSelect(newVariations);
            setPrompt('');

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate edit.');
        } finally {
            setGenerationStatus('idle');
        }
    };
    if (isDevMode && selectedObject) {
        const boxToUse = modifiedBoxes[selectedObject.id] || selectedObject.box;
        const maskBase64 = createMaskFromBox(boxToUse, imgSize.width, imgSize.height);
        const maskUrl = `data:image/png;base64,${maskBase64}`;
        setDevModalState({
            isOpen: true,
            onConfirm: () => {
                setDevModalState({ isOpen: false, data: null, onConfirm: () => {} });
                execute();
            },
            data: {
                title: t('devModeEditorTitle'),
                prompt: `You are a professional photo editor. Your task is to edit an image based on a user's request, but you MUST ONLY modify the white masked area. The rest of the image (the black area) must remain completely unchanged. Do not alter the original image's style, lighting, or composition. The user's request is: "${prompt}". Apply this change seamlessly and realistically to the masked region.`,
                images: [
                    { title: t('devModeOriginalImage'), url: currentImage.imageUrl },
                    { title: t('devModeMaskImage'), url: maskUrl },
                ],
            },
        });
    } else {
        execute();
    }
  };

  const handleReposition = async () => {
    if (movedObjects.length === 0 || !imageRef.current) return;

    const executeFinalStep = async (generatedPrompt: string, instructionImageBase64: string) => {
        setGenerationStatus('generating');
        setError(null);
        try {
            const mimeType = 'image/png';
            const newImageBase64Array = await applyRepositionEdit(instructionImageBase64, mimeType, generatedPrompt);
            
            const newVariations = newImageBase64Array.map((b64, i) => ({
              id: `repositioned-${Date.now()}-${i}`,
              title: `Repositioned Variation ${i + 1}`,
              description: 'Result of moving objects',
              imageUrl: `data:${mimeType};base64,${b64}`,
              createdAt: new Date(),
            }));
            
            setVariationsToSelect(newVariations);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reposition objects.');
        } finally {
            setGenerationStatus('idle');
        }
    };

    setGenerationStatus('generating');
    setError(null);
    try {
        const movements = movedObjects.map(obj => ({
            originalBox: obj.box, newBox: modifiedBoxes[obj.id]
        }));
        const visualInstructionImageBase64 = drawMovementInstructions(imageRef.current, movements);
        
        const movedObjectData = movedObjects.map(obj => ({
          label: obj.label,
          originalBox: obj.box,
          newBox: modifiedBoxes[obj.id]!
        }));
        const generatedPrompt = await generateRepositionPrompt(visualInstructionImageBase64, movedObjectData);

        if (isDevMode) {
            const instructionImageUrl = `data:image/png;base64,${visualInstructionImageBase64}`;
            setDevModalState({
                isOpen: true,
                onConfirm: () => {
                    setDevModalState({ isOpen: false, data: null, onConfirm: () => {} });
                    executeFinalStep(generatedPrompt, visualInstructionImageBase64);
                },
                data: {
                    title: t('devModeEditorTitle'),
                    prompt: `You are a professional VFX compositor... COMMAND: "${generatedPrompt}"`,
                    images: [{ title: t('devModeInstructionImage'), url: instructionImageUrl }],
                },
            });
        } else {
            executeFinalStep(generatedPrompt, visualInstructionImageBase64);
        }
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate reposition prompt.');
        setGenerationStatus('idle');
    }
  };

  const handleSelectVariation = (selectedVariation: ImageVariation) => {
    setVariationsToSelect(null);
    setGenerationStatus('analyzing');
    addNewStateToHistory(selectedVariation);
    setSelectedObjectId(null);
    setModifiedBoxes({});
  };
  
  const handleHistoryClick = (index: number) => {
    if (generationStatus !== 'idle' || isLoading || index === historyIndex) return;
    const targetState = history[index];
    setHistoryIndex(index);
    setCurrentImage(targetState.image);
    setObjects(targetState.objects);
    setModifiedBoxes(targetState.modifiedBoxes);
    setSelectedObjectId(null);
    setInteractiveBox(null);
    setError(null);
  };
  
  const handleDoneClick = () => {
    if (history.length === 0 || historyIndex < 0) {
        onDone(undefined);
        return;
    }
    const finalState = history[historyIndex];
    const finalImageWithData: ImageVariation = {
        ...finalState.image,
        objects: finalState.objects,
    };
    const hasChanged = finalImageWithData.id !== image.id;
    onDone(hasChanged ? finalImageWithData : undefined);
  };
  
  const handleRenameObject = useCallback((id: string, newLabel: string) => {
    const updateRecursive = (nodes: DetectedObject[]): DetectedObject[] => {
        return nodes.map(node => {
            if (node.id === id) {
                return { ...node, label: newLabel };
            }
            if (node.children && node.children.length > 0) {
                return { ...node, children: updateRecursive(node.children) };
            }
            return node;
        });
    };
    const newObjects = updateRecursive(objects);
    setObjects(newObjects);
    
    if (history[historyIndex]) {
        const newHistory = [...history];
        newHistory[historyIndex] = { ...history[historyIndex], objects: newObjects };
        setHistory(newHistory);
    }
  }, [objects, history, historyIndex]);

  const isActionInProgress = generationStatus !== 'idle' || isLoading;
  
  const progressMessage = useMemo(() => {
    if (generationStatus === 'generating') {
      return 'Generating...';
    }
    if (generationStatus === 'analyzing') {
      return 'Analyzing objects...';
    }
    if (isLoading) {
      return t('detectingObjects');
    }
    return '';
  }, [generationStatus, isLoading]);


  return (
    <div className="flex flex-col h-screen bg-[#0D0D0D] text-white">
      <header className="flex items-center p-4 border-b border-white/10 flex-shrink-0 h-[65px]">
        <button onClick={() => onDone()} className="flex items-center gap-2 text-gray-300 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          <span className="font-semibold">{t('backToAlbum')}</span>
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        <main className="flex-1 flex items-center justify-center p-8 min-h-0">
            <div className="relative w-full h-full" ref={imageContainerRef}>
                <img ref={imageRef} src={currentImage.imageUrl} alt={currentImage.title} className="w-full h-full object-contain pointer-events-none" crossOrigin="anonymous" onLoad={calculateLayout}/>
                {progressMessage && !variationsToSelect && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-30 backdrop-blur-sm rounded-md">
                        <Spinner size="lg" />
                        <p className="mt-4 text-white font-semibold">{progressMessage}</p>
                    </div>
                )}
                {childObjectsOfSelected.map(child => {
                  const boxToUse = modifiedBoxes[child.id] || child.box;
                  const box = {
                      x: (boxToUse.xMin / 1000) * imageLayout.width + imageLayout.left,
                      y: (boxToUse.yMin / 1000) * imageLayout.height + imageLayout.top,
                      width: ((boxToUse.xMax - boxToUse.xMin) / 1000) * imageLayout.width,
                      height: ((boxToUse.yMax - boxToUse.yMin) / 1000) * imageLayout.height,
                  };
                  return <StaticBoundingBox key={child.id} box={box} />;
                })}
                {movedObjects.map(obj => {
                  const boxToUse = modifiedBoxes[obj.id];
                  if (!boxToUse) return null;

                  const centerX = ((boxToUse.xMin + boxToUse.xMax) / 2 / 1000) * imageLayout.width + imageLayout.left;
                  const centerY = ((boxToUse.yMin + boxToUse.yMax) / 2 / 1000) * imageLayout.height + imageLayout.top;

                  return (
                    <div
                      key={`dot-${obj.id}`}
                      className="absolute w-3 h-3 bg-white rounded-full ring-2 ring-black/50 cursor-pointer z-20"
                      style={{
                        left: `${centerX}px`,
                        top: `${centerY}px`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedObjectId(obj.id);
                      }}
                    />
                  );
                })}
                {interactiveBox && <InteractiveBoundingBox box={interactiveBox} onBoxChange={handleBoxUpdate} bounds={imageLayout} />}
                {variationsToSelect && (
                    <EditorVariationSelector
                        variations={variationsToSelect}
                        onSelect={handleSelectVariation}
                        onCancel={() => setVariationsToSelect(null)}
                    />
                )}
            </div>
        </main>

        <aside className="w-80 bg-[#1C1C1E] flex flex-col border-l border-white/10">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-base font-bold text-white">{t('layers')}</h2>
                <button 
                  onClick={() => runObjectDetection(currentImage, historyIndex)}
                  disabled={isActionInProgress}
                  className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t('reDetectObjects')}
                >
                  <RedetectIcon />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                {isLoading && <ObjectLayerSkeleton />}
                {!isLoading && error && <p className="text-red-400 p-2">{error}</p>}
                {!isLoading && !error && objects.length === 0 && <p className="text-gray-400 p-2">No objects detected.</p>}
                {!isLoading && !error && objects.map(obj => (
                    <ObjectLayer key={obj.id} object={obj} level={0} selectedObjectId={selectedObjectId} onSelect={setSelectedObjectId} isExpanded={expandedObjectIds.has(obj.id)} onToggleExpand={(id) => setExpandedObjectIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })} onRename={handleRenameObject} />
                ))}
            </div>
             <div className="p-4 border-t border-white/10 space-y-3">
                <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={selectedObject ? `Edit ${selectedObject.label}...` : "Select an object to edit..."} className="w-full bg-[#2C2C2E] p-2 rounded text-white placeholder-gray-400 disabled:opacity-50" disabled={!selectedObject || isActionInProgress} />
                <button onClick={handleGenerateEdit} disabled={!prompt || !selectedObject || isActionInProgress} className="w-full bg-white text-black font-semibold px-5 py-2 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center">
                  {generationStatus === 'generating' ? <Spinner size="sm" /> : t('generate')}
                </button>
                {error && <p className="text-red-400 text-sm">{error}</p>}
             </div>
        </aside>
      </div>

      <footer className="h-[90px] bg-[#131314] border-t border-white/10 flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
            {history.map((state, index) => (
                <img
                    key={`${state.image.id}-${index}`}
                    src={state.image.imageUrl}
                    alt={`History ${index + 1}`}
                    onClick={() => handleHistoryClick(index)}
                    className={`w-14 h-14 rounded-md object-cover cursor-pointer transition-all ${historyIndex === index ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-[#131314]' : 'hover:ring-1 hover:ring-white/50'}`}
                />
            ))}
        </div>
        <div className="flex items-center gap-3">
            <button onClick={handleReposition} disabled={movedObjects.length === 0 || isActionInProgress} className="bg-gray-600 text-white font-semibold px-5 py-2.5 rounded-lg disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center justify-center">
                {generationStatus === 'generating' ? <Spinner size="sm" /> : t('applyMove')}
            </button>
            <button onClick={handleDoneClick} className="bg-white text-black font-semibold px-5 py-2.5 rounded-lg">{t('done')}</button>
        </div>
      </footer>
      <EditorDevModeConfirmationModal
        isOpen={devModalState.isOpen}
        onClose={() => setDevModalState({ isOpen: false, data: null, onConfirm: () => {} })}
        onConfirm={devModalState.onConfirm}
        modalData={devModalState.data}
      />
    </div>
  );
};
