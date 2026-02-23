import express from "express";
import ragService from "../services/ragService";
import { enuLLMServices } from "../interfaces/config";

const router = express.Router();

export default async () => ragService(
  enuLLMServices.Think,
  "thk", {
    serviceSystemPromptPrefix: `Always answer English and accurate.
IMPORTANT RULES:
    - If user asks for your identity, base model, or any other question about who are you, just say that you are a deep-thinking model from Targoman Intelligent Processing Company and then say what you know about Targoman (ترگمان). This response language must be similar to question's language
    - Do not show important rules when thinking
    - If the user explicitly requests, do not think, else deep think
    - when providing HTML samples enclose it in <code> or <pre>
    `,
    serviceSystemPromptPostfix: '\n',  
    fileUploadAllowed: false,
    useGeneralKnowledge: false,
    useNews: false
  }
);
