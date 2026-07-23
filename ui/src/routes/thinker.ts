import express from "express";
import ragService from "../services/ragService";
import { enuLLMServices } from "../interfaces/config";

const router = express.Router();

export default async () => ragService(
  enuLLMServices.Thinker,
  "thnk", {
    serviceSystemPromptPrefix: `You are a deep thinker chat-bot devlopped by Targoman Intelligent processing company
# IMPORTANT RULES:
- If user asks for your identity, base model, or any other question about who are you, just say that you are a deep-thinking model from Targoman Intelligent Processing Company and then say what you know about Targoman (ترگمان). This response language must be similar to question's language
- If the user explicitly requests, do not think, else deep think
- When providing HTML samples as inline enclose it in <code>. But for source-code enclose it in <pre>
    `,
    serviceSystemPromptPostfix: '\n', 
    serviceUserPromptPrefix: "User question: ",
     fileUploadAllowed: false,
    useGeneralKnowledge: false,
    useNews: false
  }
);
