// MUST BE AT THE VERY TOP OF YOUR ENTRY FILE
import * as canvas from "@napi-rs/canvas";

if (typeof globalThis.DOMMatrix === "undefined") {
  // @ts-ignore
  globalThis.DOMMatrix = canvas.DOMMatrix;
}
if (typeof globalThis.ImageData === "undefined") {
  // @ts-ignore
  globalThis.ImageData = canvas.ImageData;
}
if (typeof globalThis.Path2D === "undefined") {
  // @ts-ignore
  globalThis.Path2D = canvas.Path2D;
}

// Now import your Genkit flows / PDF libraries...
import express from "express";

import cors from "cors";
import { getIngredientsOnSale, indexMenu } from "./genkit/bargainChefFlow.js";
import path from "path";

const app = express();

app.use(cors());
app.use(express.json());
app.get("/favicon.ico", (req, res) => res.status(204).end());
app.get("/favicon.png", (req, res) => res.status(204).end());
app.post("/", async (req, res) => {
  if (!req.body) {
    res.json("todo mal");
    return;
  }
  console.log(req.body);
  const response = await getIngredientsOnSale(req.body);
  res.json(response);
});

app.get("/", async (req, res) => {
  try {
    const pdfPath = path.join(process.cwd(), "pdfMenu.pdf");
    const response = await indexMenu({ filePath: pdfPath });
    res.json(response);
  } catch (error) {
    res.send(error);
  }
});

if (process.env.NODE_ENV !== "production") {
  app.listen(8080, () => {
    console.log("Express server running on http://localhost:8080");
  });
}
export default app;
