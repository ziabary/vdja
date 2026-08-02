import express from "express";
import ragService from "../services/ragService";
import { enuLLMServices } from "../interfaces/config";

const router = express.Router();

export default async () => ragService(
  enuLLMServices.RAG,
  "rag",
  {
    fileUploadAllowed: true,
    useGeneralKnowledge: true,
    useNews: true
  }
);
