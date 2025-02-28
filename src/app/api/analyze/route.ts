import OpenAI from "openai";
import { NextResponse } from "next/server";


// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

async function summarizeChunk(chunk: string): Promise<string> {
    const prompt = `Summarize the following research content:\n\n${chunk}`;
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
    const { text } = await request.json();

    const chunks = chunkText(text , 3000)

    const summaryPromises = chunks.map((chunk:string)=>summarizeChunk(chunk))
    const chunkSummaries= await Promise.all(summaryPromises)
    
    const finalSummaryPrompt = `Summarize these individual summaries into one concise summary:\n\n${chunkSummaries.join(
        "\n\n"
      )}`;

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