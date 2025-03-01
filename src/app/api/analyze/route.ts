import OpenAI from "openai";
import { NextResponse } from "next/server";
import { pipe } from "@screenpipe/js";

interface IChunkTextFunction {
  (text: string, maxLength: number): string[];
}

const chunkText: IChunkTextFunction = (text: string, maxLength: number): string[] => {
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
}

async function summarizeChunk(chunk: string, topic: string): Promise<string> {
  const settings = await pipe.settings.getAll();
  const gptApi = settings.openaiApiKey;
  console.log(gptApi);

  const openai = new OpenAI({
    apiKey: gptApi,
  });
  
  // Updated prompt for each chunk
  const prompt = `You are an expert research assistant specializing in ${topic}. Please read the following excerpt from a research document and provide a concise, insightful summary that highlights the key findings and implications:\n\n${chunk}`;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are a helpful research assistant summarizing content concisely." },
      { role: "user", content: prompt }
    ]
  });
  
  return response.choices[0].message.content || "";
}

export async function POST(request: Request) {
  try {
    const settings = await pipe.settings.getAll();
    const gptApi = settings.openaiApiKey;
    if (!gptApi) {
      console.log("no api key");
      return NextResponse.json(
        { error: "GPT API key missing. Please configure your API key in ScreenPipe settings." },
        { status: 400 }
      );
    }
    // Initialize the OpenAI client
    const openai = new OpenAI({
      apiKey: gptApi,
    });
    
    const { text, topic } = await request.json();
    const chunks = chunkText(text, 3000);
    
    const summaryPromises = chunks.map((chunk: string) => summarizeChunk(chunk, topic));
    const chunkSummaries = await Promise.all(summaryPromises);
    
    // Updated final prompt to combine individual summaries
    const finalSummaryPrompt = `Please integrate the following individual summaries into a single, coherent, and concise summary that encapsulates the main points and conclusions:\n\n${chunkSummaries.join("\n\n")}`;
    
    // Create a streaming completion using the OpenAI SDK
    const summaryStream = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: finalSummaryPrompt }],
      stream: true,
    });
    
    const readableStream = summaryStream.toReadableStream();
    return new NextResponse(readableStream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("Error during summarization:", error);
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
