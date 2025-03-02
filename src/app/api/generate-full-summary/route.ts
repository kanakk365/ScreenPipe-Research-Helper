import { NextResponse } from "next/server";
import OpenAI from "openai";
import { pipe } from "@screenpipe/js";
import { MODELS } from "../modelConfig";

export async function POST(request: Request) {
  try {
    const settings = await pipe.settings.getAll();
    const gptApi = settings.openaiApiKey;

    if (!gptApi) {
      return NextResponse.json(
        { error: "API key missing" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: gptApi,
    });

    const { allSummaries } = await request.json();
    
    if (!allSummaries || !Array.isArray(allSummaries) || allSummaries.length === 0) {
      return NextResponse.json(
        { error: "No summaries provided" },
        { status: 400 }
      );
    }


    const summariesByTopic: Record<string, string[]> = {};
    allSummaries.forEach(summary => {
      if (!summariesByTopic[summary.topic]) {
        summariesByTopic[summary.topic] = [];
      }
      summariesByTopic[summary.topic].push(summary.text);
    });


    let prompt = `Create a comprehensive research summary based on the following collection of insights.\n\n`;
    

    prompt += `Research Period: ${new Date(allSummaries[allSummaries.length - 1].timestamp).toLocaleDateString()} to ${new Date(allSummaries[0].timestamp).toLocaleDateString()}\n\n`;
    

    Object.entries(summariesByTopic).forEach(([topic, summaries]) => {
      prompt += `## Topic: ${topic}\n\n`;
      summaries.forEach((summary, i) => {
        prompt += `Summary ${i + 1}:\n${summary}\n\n`;
      });
    });
    
    prompt += `Based on all the above research summaries, create a comprehensive synthesis that:
1. Identifies the major themes and findings across all topics
2. Highlights connections between different research areas
3. Identifies the most significant insights and their implications
4. Organizes the information in a clear, structured format with sections
5. Concludes with suggestions for further research directions`;


    const summaryStream = await openai.chat.completions.create({
      model: MODELS.finalSynthesis, 
      messages: [
        {
          role: "system",
          content: "You are a research synthesis expert who creates comprehensive summaries from collections of research insights. Format your response with clear headings, bullet points for key findings, and a structured approach."
        },
        { role: "user", content: prompt }
      ],
      stream: true,
      temperature: 0.7, 
    });

    const readableStream = summaryStream.toReadableStream();
    return new NextResponse(readableStream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("Error generating full summary:", error);
    return NextResponse.json(
      { error: "Failed to generate comprehensive summary" },
      { status: 500 }
    );
  }
}
