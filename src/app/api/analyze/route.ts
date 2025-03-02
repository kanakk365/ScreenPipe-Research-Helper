import OpenAI from "openai";
import { NextResponse } from "next/server";
import { pipe } from "@screenpipe/js";

interface IChunkTextFunction {
  (text: string, maxLength: number): string[];
}

// Cost optimization models
const MODELS = {
  chunkSummarization: "gpt-3.5-turbo", // Cheaper model for initial processing
  finalSynthesis: "gpt-4"              // Premium model only for final output
};

const chunkText: IChunkTextFunction = (
  text: string,
  maxLength: number
): string[] => {
  // Filter out empty or very short content
  if (!text || text.length < 50) {
    return text ? [text] : [];
  }

  // Split into meaningful chunks
  const sentences: string[] = text.split(/(?<=[.?!])\s+/);
  const chunks: string[] = [];
  let currentChunk: string = "";
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength) {
      chunks.push(currentChunk);
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? " " : " ") + sentence;
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  return chunks;
};

// Efficient summarization with cheaper model
async function summarizeChunk(
  chunk: string,
  topic: string,
  contextHistory: string = ""
): Promise<string> {
  // Skip empty chunks
  if (!chunk || chunk.trim().length < 30) {
    return "";
  }

  const settings = await pipe.settings.getAll();
  const gptApi = settings.openaiApiKey;

  const openai = new OpenAI({
    apiKey: gptApi,
  });

  // More concise prompt to reduce token count
  const prompt = `
Topic: ${topic}
${contextHistory ? `Previous context: ${contextHistory.substring(0, 500)}...\n` : ''}
Summarize the following research content concisely:
${chunk}`;

  try {
    const response = await openai.chat.completions.create({
      model: MODELS.chunkSummarization, // Use cheaper model here
      messages: [
        {
          role: "system",
          content: "You are a research assistant. Provide brief, factual summaries focusing only on key information."
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3, // Lower temperature for more focused responses
      max_tokens: 500,  // Limit the response size
    });

    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error in chunk summarization:", error);
    return ""; // Return empty string rather than failing the entire process
  }
}

export async function POST(request: Request) {
  try {
    const settings = await pipe.settings.getAll();
    const gptApi = settings.openaiApiKey;
    if (!gptApi) {
      console.log("no api key");
      return NextResponse.json(
        {
          error:
            "GPT API key missing. Please configure your API key in ScreenPipe settings.",
        },
        { status: 400 }
      );
    }
    
    // Initialize the OpenAI client
    const openai = new OpenAI({
      apiKey: gptApi,
    });

    const { text, topic, previousSummaries } = await request.json();
    
    // Skip processing if input is too small
    if (!text || text.length < 50) {
      return NextResponse.json({ summary: "Insufficient content to analyze." });
    }

    // Optimize chunk size for GPT-3.5 (which has 4K token context)
    const chunks = chunkText(text, 2000);

    // Create a simplified context from previous summaries (more efficient)
    const contextHistory = previousSummaries && previousSummaries.length > 0
      ? previousSummaries[0].text.substring(0, 500) // Just use the most recent summary
      : "";

    // Process chunks in parallel
    const summaryPromises = chunks.map((chunk: string) =>
      summarizeChunk(chunk, topic, contextHistory)
    );
    const chunkSummaries = (await Promise.all(summaryPromises)).filter(s => s.length > 0);

    // If no valid summaries, return early
    if (chunkSummaries.length === 0) {
      return NextResponse.json({ summary: "No meaningful content found to analyze." });
    }

    // Use GPT-4 only for final synthesis (where quality matters most)
    const finalSummaryPrompt = `
As a research assistant for ${topic}, create a cohesive summary from these points:

${chunkSummaries.join("\n\n")}

Provide a clear, organized summary highlighting key findings, patterns, and research questions.`;

    // Create a streaming completion using GPT-4 only for final synthesis
    const summaryStream = await openai.chat.completions.create({
      model: MODELS.finalSynthesis, // Use premium model only for final synthesis
      messages: [{ role: "user", content: finalSummaryPrompt }],
      stream: true,
      temperature: 0.5, // Balanced setting
    });

    const readableStream = summaryStream.toReadableStream();
    return new NextResponse(readableStream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("Error during summarization:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}
