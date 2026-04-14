import { GoogleGenAI, Modality, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const geminiModel = "gemini-3-flash-preview";
export const ttsModel = "gemini-2.5-flash-preview-tts";

export { Modality, Type };
export default ai;
