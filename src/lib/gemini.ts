import { GoogleGenAI, Modality, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const geminiModel = "gemini-flash-latest";
export const ttsModel = "gemini-3.1-flash-tts-preview";

export { Modality, Type };
export default ai;
