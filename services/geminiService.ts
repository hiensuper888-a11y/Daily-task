import { GoogleGenAI, Chat, Type } from "@google/genai";

// Safely initialize GenAI only if key exists, otherwise provide a dummy implementation or throw localized error when called.
const getAiClient = () => {
    // Use the global constant defined in vite.config.ts
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'undefined') {
        console.warn("Gemini API Key is missing or undefined.");
        return null;
    }
    return new GoogleGenAI({ apiKey });
};

const ai = getAiClient();

/**
 * Edits an image based on a text prompt using Gemini 2.5 Flash Image.
 * @param imageBase64 The base64 string of the source image (without data prefix).
 * @param mimeType The mime type of the source image.
 * @param prompt The text description of the edit.
 * @returns The base64 string of the generated image.
 */
export const editImageWithGemini = async (
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<string | null> => {
  if (!ai) throw new Error("API Key chưa được cấu hình.");
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: imageBase64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      // No specific config needed for simple edits, defaulting to model behavior
    });

    // Iterate through parts to find the image
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Gemini API Error (Image):", error);
    throw error;
  }
};

/**
 * Chats with Gemini.
 * @param message The user message.
 * @param history The chat history.
 * @returns The text response.
 */
export const chatWithGemini = async (
  message: string,
  history: { role: 'user' | 'model', parts: { text: string }[] }[]
): Promise<string> => {
    if (!ai) return "Chức năng AI chưa được kích hoạt do thiếu API Key.";

    try {
        const chat: Chat = ai.chats.create({
            model: 'gemini-3-flash-preview',
            history: history,
            config: {
                systemInstruction: "You are a helpful and friendly AI assistant inside a productivity app called 'Daily Task'. Keep answers concise and relevant."
            }
        });
        
        const response = await chat.sendMessage({ message: message });
        return response.text || "";
    } catch (error) {
        console.error("Chat API Error:", error);
        return "Xin lỗi, tôi không thể kết nối với dịch vụ AI ngay bây giờ. Vui lòng kiểm tra API Key hoặc kết nối mạng.";
    }
};

/**
 * Generates a list of subtasks based on a main task description.
 * Uses Gemini 3 Flash for fast structured output.
 */
export const generateSubtasksWithGemini = async (taskDescription: string): Promise<string[]> => {
    if (!ai) throw new Error("API Key missing");

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Break down this task into 3-6 actionable, concise subtasks (steps). Task: "${taskDescription}"`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.STRING
                    }
                }
            }
        });

        const jsonStr = response.text?.trim();
        if (!jsonStr) return [];
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Gemini Subtask Error:", error);
        return [];
    }
};

/**
 * Refines text to be more professional and concise.
 */
export const refineTaskTextWithGemini = async (text: string): Promise<string> => {
    if (!ai) throw new Error("API Key missing");

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Rewrite the following task description to be more professional, actionable, and concise (keep the same language): "${text}"`,
        });

        return response.text?.trim() || text;
    } catch (error) {
        console.error("Gemini Refine Error:", error);
        return text;
    }
};