import express from "express";
import cors from "cors";
import { expressHandler } from "@genkit-ai/express";
import { getIngredientsOnSale, indexMenu } from "./genkit/bargainChefFlow.js";

const app = express();

app.use(cors());
app.use(express.json());
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
  const response = await indexMenu({ filePath: "pdfMenu.pdf" });
  res.json(response);
});

app.listen(8080, () => {
  console.log("Express server listening on http://localhost:8080");
});
