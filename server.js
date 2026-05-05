import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const apiKey = process.env.OPENAI_API_KEY;

// Initialize the OpenAI client
let openai;
if (apiKey && apiKey !== 'your_openai_api_key_here') {
  openai = new OpenAI({ apiKey });
}

app.post('/api/analyze-transcript', async (req, res) => {
  if (!openai) {
    return res.status(500).json({ error: "OpenAI API key is missing or invalid on the server." });
  }

  const { transcriptText } = req.body;
  if (!transcriptText) {
    return res.status(400).json({ error: "Transcript text is required." });
  }

  const systemPrompt = `
You are a highly skilled medical AI assistant. Your task is to analyze clinical consultation transcripts and extract key medical information.
Please analyze the provided text and output a JSON object with the following structure:
{
  "summary": "A brief 2-3 sentence summary of the consultation.",
  "medicalTerms": ["list", "of", "extracted", "medical", "terms", "and", "jargon"],
  "diagnoses": ["list", "of", "suspected", "or", "confirmed", "diagnoses"],
  "medications": ["list", "of", "medications", "prescribed", "or", "discussed"],
  "actionItems": ["list", "of", "follow-up", "actions", "or", "tests", "ordered"],
  "importantInfo": ["any", "other", "critical", "observations", "or", "patient", "concerns"]
}
Ensure the output is strictly valid JSON and nothing else.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcriptText }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2, // Low temperature for factual consistency
    });

    const resultString = response.choices[0].message.content;
    const resultJson = JSON.parse(resultString);
    res.json(resultJson);
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    res.status(500).json({ error: "Failed to analyze transcript." });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
