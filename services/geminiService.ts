
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ImageVariation, ApiObject, BoundingBox } from "../types";
import { getCurrentLanguage } from "../i18n";
import { apiService } from "./apiService";

let ai: GoogleGenAI | null = null;

// Lazy initialization of the AI client
const getAiClient = (): GoogleGenAI => {
  if (!ai) {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable not set. Please configure it to use the AI features.");
    }
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
};

// Helper to extract a JSON object or array from a string that might contain extraneous text or markdown fences.
const extractJson = (text: string): string => {
    // First, try to find JSON within markdown fences (```json ... ```)
    const markdownMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        return markdownMatch[1].trim();
    }

    // If no markdown fence, find the first '{' or '[' and the last '}' or ']'
    const firstBracket = text.indexOf('[');
    const firstBrace = text.indexOf('{');
    
    let start = -1;
    
    if (firstBracket === -1) {
        start = firstBrace;
    } else if (firstBrace === -1) {
        start = firstBracket;
    } else {
        start = Math.min(firstBracket, firstBrace);
    }
    
    if (start === -1) {
        // If we found neither, the response is not valid JSON.
        // It could be a conversational refusal from the model.
        throw new Error(`Could not find a valid JSON object or array in the response. Model returned: "${text}"`);
    }

    const lastBracket = text.lastIndexOf(']');
    const lastBrace = text.lastIndexOf('}');
    
    const end = Math.max(lastBracket, lastBrace);

    if (end === -1 || end < start) {
        throw new Error(`Could not find a valid JSON object or array in the response. Model returned: "${text}"`);
    }

    return text.substring(start, end + 1);
};


// This is an internal helper function, not exported.
const editImageInternal = async (
  images: { base64Data: string, mimeType: string }[],
  prompt: string,
  maskBase64?: string
): Promise<string> => {
  try {
    // Validate the prompt to prevent API errors from empty/invalid text parts.
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      throw new Error("A valid, non-empty prompt is required for image editing.");
    }
    // Allow text-only generation when no images are provided
      
    const client = getAiClient();

    const imageParts = images && images.length > 0 
      ? images.map(img => ({ inlineData: { data: img.base64Data, mimeType: img.mimeType } }))
      : [];

    const parts: any[] = [
      ...imageParts,
      { text: prompt },
    ];
    
    if (maskBase64) {
      // The mask applies to the first image in the sequence.
      parts.unshift({
        inlineData: { data: maskBase64, mimeType: 'image/png' }
      });
    }

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    if (!response.candidates || response.candidates.length === 0) {
      if (response.promptFeedback?.blockReason) {
        throw new Error(`Image generation was blocked. Reason: ${response.promptFeedback.blockReason}`);
      }
      throw new Error('The API did not return any candidates. The request may have been blocked or failed.');
    }
    
    const candidate = response.candidates[0];
    
    if (!candidate.content?.parts) {
        throw new Error('The API returned a candidate with no content parts.');
    }

    let returnedImage: string | null = null;
    let returnedText: string | null = null;

    for (const part of candidate.content.parts) {
      if (part.inlineData && part.inlineData.data) {
        returnedImage = part.inlineData.data;
      } else if (part.text) {
        returnedText = part.text;
      }
    }

    if (returnedImage) {
      return returnedImage;
    }

    let errorMessage = 'The API did not return an image. The response may have been blocked.';
    if (returnedText) {
      errorMessage = `The AI failed to generate an image and returned this message: "${returnedText}"`;
    }

    throw new Error(errorMessage);
    
  } catch (error) {
    console.error('Error calling Gemini API for image editing:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Could not edit the image.');
  }
};

const generationPlanSchema = {
  type: Type.OBJECT,
  properties: {
    textResponse: {
      type: Type.STRING,
      description: 'A short, conversational text response to the user acknowledging their request. Should be creative and encouraging. IMPORTANT: Respond in the language specified by the "lang" field.',
    },
    variations: {
      type: Type.ARRAY,
      description: 'A list of 3 creative variations to generate based on the user prompt.',
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'A short, catchy title for this variation (e.g., "Vibrant Red," "Studio Shot"). Must be in the user\'s language.'
          },
          description: {
            type: Type.STRING,
            description: 'A brief, one-sentence description of what makes this variation unique. Must be in the user\'s language.'
          },
          modifiedPrompt: {
            type: Type.STRING,
            description: 'The full, detailed prompt to be used for generating this specific image variation, building upon the original user prompt. MUST be a non-empty string written in ENGLISH.'
          }
        },
        required: ["title", "description", "modifiedPrompt"]
      }
    },
    followUpSuggestions: {
        type: Type.ARRAY,
        description: 'A list of 4 short, actionable follow-up prompts the user could try next (e.g., "Add custom racing stripes", "Try a different angle"). Must be in the user\'s language.',
        items: {
            type: Type.STRING,
        }
    }
  },
  required: ["textResponse", "variations", "followUpSuggestions"]
};

type PlanResult = {
  textResponse: string;
  variations: any[];
  followUpSuggestions: string[];
};

type GeneratorYield = 
  | { status: 'progress', message: string }
  | { plan: PlanResult, groundingMetadata?: any }
  | ImageVariation;


// This is now an async generator to stream results
export async function* generateImageEdits(
  images: { base64Data: string, mimeType: string }[],
  userPrompt: string,
  useWebSearch: boolean = false,
  albumId?: string
): AsyncGenerator<GeneratorYield> {
  
  const client = getAiClient();
  const lang = getCurrentLanguage();

  let planPrompt: string;
  const config: any = {}; 
  const imageParts = images && images.length > 0 
    ? images.map(img => ({ inlineData: { data: img.base64Data, mimeType: img.mimeType } }))
    : [];
  const contents: any = { parts: [...imageParts] };

  if (useWebSearch) {
    yield { status: 'progress', message: 'Searching the web for inspiration...' };
    await new Promise(resolve => setTimeout(resolve, 2000)); // Increased delay for better pacing
    yield { status: 'progress', message: 'Analyzing results to craft prompts...' };
    await new Promise(resolve => setTimeout(resolve, 1500)); // Increased delay
    
    config.tools = [{ googleSearch: {} }];
    
    planPrompt = `You are a creative AI assistant. A user has provided ${images.length > 0 ? `${images.length} image(s) and` : ''} a prompt in "${lang}": "${userPrompt}".

        Your task is to create a superior generation plan using multilingual web search.
        1.  ${images.length > 0 ? 'Analyze ALL provided images\' content, style, and composition.' : 'Create a generation plan based purely on the user\'s text prompt.'}
        2.  Take the user's prompt and perform Google searches for advanced "nano banana" (a generative AI model) techniques. Search in MULTIPLE LANGUAGES, including English, Japanese, and Korean, to find diverse ideas.
        3.  Synthesize your findings from the multilingual search and the original request to create a generation plan.
        4.  Write a brief, encouraging, conversational response to the user. YOU MUST RESPOND IN THE USER'S LANGUAGE (${lang}).
        5.  Come up with 3 distinct, creative variations based on your findings. For each, create a title and description in the user's language.
        6.  The 'modifiedPrompt' field MUST be a non-empty, highly detailed string written in ENGLISH for the image model.
        7.  Generate 4 actionable follow-up prompts in the user's language.
        
        EXTREMELY IMPORTANT: Your entire response must be a single, valid JSON object following this structure:
        {
          "textResponse": "string",
          "variations": [
            {"title": "string", "description": "string", "modifiedPrompt": "string"},
            {"title": "string", "description": "string", "modifiedPrompt": "string"},
            {"title": "string", "description": "string", "modifiedPrompt": "string"}
          ],
          "followUpSuggestions": ["string", "string", "string", "string"]
        }
        Do NOT include any text, explanations, or markdown formatting before or after the JSON object.`;
    
    contents.parts.push({ text: planPrompt });

  } else {
     config.responseMimeType = 'application/json';
     config.responseSchema = generationPlanSchema;
     planPrompt = `You are a world-class creative director and prompt engineer acting as a planner. A user wants to ${images.length > 0 ? `edit/combine ${images.length} image(s) with` : 'generate images from'} the prompt: "${userPrompt}". The user's language is "${lang}".
        
        Your task is to ${images.length > 0 ? 'analyze ALL provided images and' : ''} conceptualize 3 distinct, high-quality artistic variations.
        1.  Write a brief, encouraging, conversational response in the USER'S LANGUAGE (${lang}).
        2.  For each variation, create a short title and a one-sentence description, also in the USER'S LANGUAGE.
        3.  For each variation's 'modifiedPrompt' (which must be in ENGLISH), write a descriptive, multi-sentence paragraph. Do NOT use simple keywords. Instead, describe a complete photorealistic scene. Incorporate professional photographic terms like camera angles (e.g., "low-angle shot", "close-up"), lens types (e.g., "85mm portrait lens", "wide-angle"), and lighting conditions (e.g., "golden hour light", "softbox setup", "cinematic lighting").
        4.  Generate 4 short, actionable follow-up prompts in the USER'S LANGUAGE.
        
        Return this plan in the specified JSON format.`;
    
    contents.parts.push({ text: planPrompt });
  }

  const planResponse = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: contents,
    config: config
  });
  
  // When using responseSchema, the response is already valid JSON
  const plan = config.responseSchema ? JSON.parse(planResponse.text) : JSON.parse(extractJson(planResponse.text));
  
  const groundingMetadata = planResponse.candidates?.[0]?.groundingMetadata;

  if (!plan.textResponse || !Array.isArray(plan.variations) || plan.variations.length === 0) {
    throw new Error("Failed to create a valid generation plan.");
  }

  // Yield the initial text response and suggestions
  yield { plan, groundingMetadata };
  yield { status: 'progress', message: 'Remixing your image with new ideas...' };


  for (const variation of plan.variations) {
    try {
      // If the AI planner fails to generate a prompt, create a fallback.
      const promptForGeneration = (variation.modifiedPrompt || "").trim()
        ? variation.modifiedPrompt
        : `${userPrompt}, in the style of: ${variation.title}`;

      const editedImageBase64 = await editImageInternal(images, promptForGeneration);
      
      // Save image to server and get URL
      // Use a default mimeType if no source images provided
      const mimeType = images.length > 0 ? images[0].mimeType : 'image/png';
      const savedImage = await apiService.saveBase64Image(
        `data:${mimeType};base64,${editedImageBase64}`,
        variation.title,
        variation.description,
        albumId
      );
      
      const newVariation: ImageVariation = {
        id: savedImage.id,
        title: savedImage.title,
        description: savedImage.description,
        imageUrl: savedImage.imageUrl,
        createdAt: savedImage.createdAt,
      };
      yield newVariation; // Yield each image as it's generated
    } catch (error) {
      console.error(`Failed to generate variation "${variation.title}":`, error);
       // Create a fallback for the retry payload as well.
      const promptForRetry = (variation.modifiedPrompt || "").trim()
        ? variation.modifiedPrompt
        : `${userPrompt}, in the style of: ${variation.title}`;

      const errorVariation: ImageVariation = {
        id: Date.now().toString() + Math.random(),
        title: variation.title,
        description: variation.description,
        imageUrl: '', // No image URL
        createdAt: new Date(),
        isError: true,
        errorMessage: error instanceof Error ? error.message : 'Unknown generation error.',
        retryPayload: {
          images: images,
          prompt: promptForRetry,
        }
      };
      yield errorVariation;
    }
  }
}

export const retryImageGeneration = async (
    images: { base64Data: string, mimeType: string }[],
    prompt: string
): Promise<string> => {
    return await editImageInternal(images, prompt);
};

export const editImageWithMask = async (
    imageBase64: string,
    mimeType: string,
    prompt: string,
    maskBase64: string
): Promise<string[]> => {
    const maskedPrompt = `You are a professional photo editor. Your task is to edit an image based on a user's request, but you MUST ONLY modify the white masked area. The rest of the image (the black area) must remain completely unchanged. Do not alter the original image's style, lighting, or composition. The user's request is: "${prompt}". Apply this change seamlessly and realistically to the masked region.`;
    
    const imageInput = [{ base64Data: imageBase64, mimeType: mimeType }];
    const promises = [
        editImageInternal(imageInput, maskedPrompt, maskBase64),
        editImageInternal(imageInput, maskedPrompt, maskBase64),
        editImageInternal(imageInput, maskedPrompt, maskBase64),
    ];
    return Promise.all(promises);
};

export const generateRepositionPrompt = async (
    visualInstructionImageBase64: string,
    movedObjects: { label: string; originalBox: BoundingBox; newBox: BoundingBox }[]
): Promise<string> => {
    try {
        const client = getAiClient();
        const objectNames = movedObjects.map(obj => `'${obj.label}'`).join(', ');

        const scalingInstructions = movedObjects.map(obj => {
            const originalWidth = obj.originalBox.xMax - obj.originalBox.xMin;
            const originalHeight = obj.originalBox.yMax - obj.originalBox.yMin;
            const newWidth = obj.newBox.xMax - obj.newBox.xMin;
            const newHeight = obj.newBox.yMax - obj.newBox.yMin;

            const originalArea = originalWidth * originalHeight;
            const newArea = newWidth * newHeight;
            
            if (originalArea <= 0) return `For '${obj.label}', move it as shown.`;

            const ratio = newArea / originalArea;
            
            if (ratio > 1.2) {
                return `For '${obj.label}', make it appear closer to the camera (larger).`;
            } else if (ratio < 0.8) {
                return `For '${obj.label}', make it appear further away (smaller).`;
            } else {
                return `For '${obj.label}', you MUST preserve its original scale and size exactly. DO NOT RESIZE IT.`;
            }
        }).join('\n    - ');

        const prompt = `You are a command-line tool that translates visual instructions into a single, concise English command for a VFX compositor AI.

**VISUAL INSTRUCTIONS:**
The image contains red arrows and bounding boxes indicating object edits.

**ANALYSIS RULES:**
1.  **Movement:** The primary instruction is to MOVE the object(s) to the location of the red bounding box(es).
2.  **Scaling & Depth:** Analyze the provided scaling instructions below.
    - ${scalingInstructions}
3.  **Subtle Edits:** If an arrow is very short and the box size is similar, infer a subtle change (e.g., "sharpen the edges of ${objectNames}").

**OUTPUT CONSTRAINTS:**
- Your entire response MUST be a single line containing only the generated command.
- Do NOT use quotes or markdown.
- Do NOT include any explanations, greetings, or conversational filler.
- Be direct and clear.

**Objects being edited: ${objectNames}.**`;
        
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { data: visualInstructionImageBase64, mimeType: 'image/png' } },
                    { text: prompt }
                ]
            }
        });
        
        const firstLine = response.text.trim().split('\n')[0];
        return firstLine.replace(/^"|"$/g, '').trim();

    } catch (error) {
        console.error('Error generating reposition prompt:', error);
        throw new Error('Could not generate a prompt for repositioning.');
    }
};

export const applyRepositionEdit = async (
    visualInstructionImageBase64: string,
    mimeType: string,
    generatedPrompt: string
): Promise<string[]> => {
    const finalPrompt = `You are a professional VFX compositor. You have been given a single 'visual instruction' image that uses red arrows to indicate object movements, along with a text command.

    **CRITICAL INSTRUCTIONS:**
    1.  **EXECUTE THE COMMAND:** You must perform the edit described in the command below.
    2.  **USE THE VISUAL GUIDE:** The red arrows in the image are your primary guide for the exact movement paths.
    3.  **FLAWLESS INPAINTING:** The areas where the objects were originally located must be perfectly reconstructed (inpainted), leaving absolutely no trace, ghosting, or artifacts. This is the most important step.
    4.  **PRESERVE THE ORIGINAL:** Do NOT change the style, lighting, color grading, or any other aspect of the original image not covered by the edit.
    5.  **CLEAN FINAL OUTPUT:** The final image you return MUST be a clean, photorealistic image. It MUST NOT contain the red arrows or any other visual artifacts.
    
    **COMMAND:**
    "${generatedPrompt}"`;

    const imageInput = [{ base64Data: visualInstructionImageBase64, mimeType: mimeType }];
    const promises = [
        editImageInternal(imageInput, finalPrompt),
        editImageInternal(imageInput, finalPrompt),
        editImageInternal(imageInput, finalPrompt),
    ];
    return Promise.all(promises);
};


const objectSegmentationSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: {
        type: Type.STRING,
        description: "A unique identifier for this object."
      },
      parentId: {
        type: Type.STRING,
        description: "The 'id' of the parent object, or null if it's a root object."
      },
      label: {
        type: Type.STRING,
        description: "A descriptive label for the detected object."
      },
      box_2d: {
        type: Type.ARRAY,
        description: "The normalized bounding box [yMin, xMin, yMax, xMax], values 0-1000.",
        items: { type: Type.NUMBER },
        minItems: 4,
        maxItems: 4,
      },
    },
    required: ["id", "parentId", "label", "box_2d"]
  }
};

export const segmentObjectsInImage = async (
  imageBase64: string,
  mimeType: string,
): Promise<ApiObject[]> => {
  console.log("Starting object segmentation with JSON schema enforcement (no masks)...");
  try {
    const client = getAiClient();
    const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { inlineData: { data: imageBase64, mimeType: mimeType } },
                { text: "Analyze the image and detect objects with focus on these categories: 1) Clothing items (shirts, pants, dresses, jackets, etc.) 2) Fashion accessories (bags, jewelry, watches, sunglasses, belts, scarves) 3) Footwear 4) Products and branded items 5) Text or logos 6) Main subjects (people, animals) as whole entities. For each object provide: a unique 'id', a descriptive 'label', its 'parentId' (the 'id' of the containing object, or null for top-level), and its normalized 2D 'box_2d'. IMPORTANT: Do NOT segment body parts like eyes, nose, mouth, ears, hands. Keep people/animals as single entities. Focus on items that can be edited, replaced, or styled. Create a simple hierarchy - for example, a 'Person' might parent their 'T-shirt' and 'Backpack', but do not break down facial features." }
            ]
        },
        config: {
            // Enforce a structured JSON response using a schema for reliability.
            responseMimeType: 'application/json',
            responseSchema: objectSegmentationSchema,
            thinkingConfig: { thinkingBudget: 0 }
        }
    });
    console.log("Raw JSON response from Gemini for segmentation:", response.text);

    const detectedObjects = JSON.parse(response.text);
    console.log("Successfully parsed detected objects:", detectedObjects);

    if (!Array.isArray(detectedObjects)) {
        console.error("Parsed data is not an array:", detectedObjects);
        throw new Error("API returned an invalid format for object segmentation.");
    }
    
    // Normalize empty string parentId to null for consistent tree building.
    return detectedObjects.map(obj => ({
        ...obj,
        parentId: obj.parentId || null,
    }));

  } catch (error) {
    console.error("Detailed error during object segmentation:", error);
    throw new Error("Could not detect objects in the image.");
  }
};