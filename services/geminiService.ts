import { GoogleGenAI, Chat } from "@google/genai";

// Declare process for TypeScript since @types/node might not be present
declare const process: { env: { API_KEY: string } };

// The API key must be obtained exclusively from the environment variable process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    console.error("Gemini API Error:", error);
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
  history: { role: 'user' | 'model', parts: [{ text: string }] }[]
): Promise<string> => {
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
        return "Sorry, I am having trouble connecting to the AI service right now.";
    }
};