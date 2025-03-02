import OpenAI from "openai";
import { NextResponse } from "next/server";
import { pipe } from "@screenpipe/js";

interface IChunkTextFunction {
  (text: string, maxLength: number): string[];
}

const MODELS = {
  chunkSummarization: "gpt-3.5-turbo",
  finalSynthesis: "gpt-4",
};

const chunkText: IChunkTextFunction = (
  text: string,
  maxLength: number
): string[] => {
  if (!text || text.length < 50) {
    return text ? [text] : [];
  }
  const sentences: string[] = text.split(/(?<=[.?!])\s+/);
  const chunks: string[] = [];
  let currentChunk: string = "";
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength) {
      chunks.push(currentChunk);
      currentChunk = sentence;
    } else {
      currentChunk = +(currentChunk ? " " : " ") + sentence;
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  return chunks;
};

async function summarizeChunk(
  chunk: string,
  topic: string,
  contextHistory: string = ""
): Promise<string> {
  if (!chunk || chunk.trim().length < 30) {
    return "";
  }

  const settings = await pipe.settings.getAll();
  const gptApi = settings.openaiApiKey;

  const openai = new OpenAI({
    apiKey: gptApi,
  });

  const prompt = `
Topic: ${topic}
${
  contextHistory
    ? `Previous context: ${contextHistory.substring(0, 500)}...\n`
    : ""
}
Summarize the following research content concisely:
${chunk}`;

  try {
    const response = await openai.chat.completions.create({
      model: MODELS.chunkSummarization,
      messages: [
        {
          role: "system",
          content:
            "You are a research assistant. Provide brief, factual summaries focusing only on key information.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error in chunk summarization:", error);
    return "";
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

    const openai = new OpenAI({
      apiKey: gptApi,
    });

    const { text, topic, previousSummaries } = await request.json();

    if (!text || text.length < 50) {
      return NextResponse.json({ summary: "Insufficient content to analyze." });
    }

    const chunks = chunkText(text, 2000);

    const contextHistory =
      previousSummaries && previousSummaries.length > 0
        ? previousSummaries[0].text.substring(0, 500)
        : "";

    const summaryPromises = chunks.map((chunk:string)=>summarizeChunk(chunk , topic , contextHistory))

    const chunkSummaries = ((await Promise.all(summaryPromises)).filter(
      (s)=>s.length>0
    ))

    if (chunkSummaries.length === 0) {
      return NextResponse.json({
        summary: "No meaningful content found to analyze.",
      });
    }

    const finalSummaryPrompt = `
As a research assistant for ${topic}, create a cohesive summary from these points:

${chunkSummaries.join("\n\n")}

Provide a clear, organized summary highlighting key findings, patterns, and research questions.`;

    const summaryStream = await openai.chat.completions.create({
      model: MODELS.finalSynthesis,
      messages: [{ role: "user", content: finalSummaryPrompt }],
      stream: true,
      temperature: 0.5,
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
