if (typeof globalThis.DOMMatrix === "undefined") {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    constructor() {}
    multiply() {
      return this;
    }
    scale() {
      return this;
    }
    // Añade aquí cualquier método que el log te indique que falta
  };
}

import { googleAI } from "@genkit-ai/google-genai";
import { Document, genkit, z } from "genkit";
import "dotenv/config";
import pinecone, {
  pineconeIndexerRef,
  pineconeRetrieverRef,
} from "genkitx-pinecone";
import { apiKey } from "genkit/context";
import path from "path";
import { PDFParse } from "pdf-parse";
import { readFile, readFileSync } from "fs";
import { chunk } from "llm-chunk";

export const CONSTANTS = {
  API_GOOGLE: process.env.GEMINI_API_KEY!,
  API_PINECONE: process.env.PINECONE_API_KEY!,
};

const ai = genkit({
  plugins: [
    googleAI({ apiKey: CONSTANTS.API_GOOGLE }),
    pinecone([
      {
        indexId: "bob-facts",
        embedder: googleAI.embedder("gemini-embedding-001"),
        clientParams: { apiKey: CONSTANTS.API_PINECONE },
      },
    ]),
  ],
  model: googleAI.model("gemini-flash-latest"),
});

const chunkingConfig = {
  minLength: 1000,
  maxLength: 2000,
  splitter: "sentence",
  overlap: 100,
  delimiters: "",
} as any;

async function extractTextFromPdf(filePath: string) {
  const pdfFile = path.resolve(filePath);
  const dataBuffer = readFileSync(pdfFile);
  const parser = new PDFParse({ data: dataBuffer });
  try {
    const result = await parser.getText();
    console.log(result.text);
    return result.text;
  } catch (error) {
    throw new Error(
      `Failed to parse PDF: ${error instanceof Error ? error.message : error}`,
    );
  } finally {
    await parser.destroy();
  }
}
export const bobFactsIndexer = pineconeIndexerRef({
  indexId: "bob-facts",
});

export const indexMenu = ai.defineFlow(
  {
    name: "indexMenu",
    inputSchema: z.object({ filePath: z.string().describe("PDF file path") }),
    outputSchema: z.object({
      success: z.boolean(),
      documentsIndexed: z.number(),
      error: z.string().optional(),
    }),
  },
  async ({ filePath }) => {
    try {
      filePath = path.resolve(filePath);

      // Read the pdf
      const pdfTxt = await ai.run("extract-text", () =>
        extractTextFromPdf(filePath),
      );

      // Divide the pdf text into segments
      const chunks = await ai.run("chunk-it", async () =>
        chunk(pdfTxt, chunkingConfig),
      );

      // Convert chunks of text into documents to store in the index.
      const documents = chunks.map((text) => {
        return Document.fromText(text, { filePath });
      });

      // Add documents to the index
      await ai.index({
        indexer: bobFactsIndexer,
        documents,
      });

      return {
        success: true,
        documentsIndexed: documents.length,
      };
    } catch (err) {
      console.log(err);
      // For unexpected errors that throw exceptions
      return {
        success: false,
        documentsIndexed: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
);

export const bobFactsRetriever = pineconeRetrieverRef({
  indexId: "bob-facts",
});

export const getIngredientsOnSale = ai.defineTool(
  {
    name: "bargainChefFlow",
    description:
      "Finds ingredients on sale based on the food the user is craving.",
    inputSchema: z.object({
      craving: z
        .string()
        .describe("What the user feels like eating right now."),
    }),
    outputSchema: z.object({
      message: z.string(),
    }),
  },
  async (input) => {
    const { craving: query } = input;

    let docs = await ai.retrieve({
      retriever: bobFactsRetriever,
      query,
      options: {
        k: 3,
      },
    });
    console.log(docs);
    try {
      const { text } = await ai.generate({
        model: googleAI.model("gemini-flash-latest"),
        prompt: `
You are acting as a helpful AI assistant that can answer
questions about the food available on the menu at Genkit Grub Pub.

Use only the context provided to answer the question.
If you don't know, do not make up an answer.
Do not add or change items on the menu.

Question: ${query}`,
        docs,
      });

      return {
        message: `Items on sale for ${text}.`,
      };
    } catch (error) {
      return { message: JSON.stringify(error) };
    }
  },
);
