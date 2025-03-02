import { NextResponse } from "next/server";
import OpenAI from "openai";
import { pipe } from "@screenpipe/js";

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

    const { text, topic } = await request.json();

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Generate 3-5 relevant tags for this research summary. Return your response as a valid JSON object with a single key 'tags' containing an array of tag strings. Example: {\"tags\": [\"machine learning\", \"neural networks\", \"AI\"]}. Only respond with the JSON object, nothing else."
        },
        {
          role: "user",
          content: `Topic: ${topic}\n\nSummary: ${text.substring(0, 1000)}`
        }
      ]
 
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in response");
    }

    try {
      let jsonContent = content;
      
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonContent = jsonMatch[1];
      }
      
      jsonContent = jsonContent.trim();
      if (jsonContent.indexOf('{') > 0) {
        jsonContent = jsonContent.substring(jsonContent.indexOf('{'));
      }
      if (jsonContent.lastIndexOf('}') < jsonContent.length - 1) {
        jsonContent = jsonContent.substring(0, jsonContent.lastIndexOf('}') + 1);
      }
      
      const parsed = JSON.parse(jsonContent);
      const tags = parsed.tags || [];
      return NextResponse.json({ tags });
    } catch (parseError) {
      console.error("Error parsing tags JSON:", parseError);
      const tagMatches = content.match(/"([^"]+)"/g) || [];
      const fallbackTags = tagMatches.map(t => t.replace(/"/g, ''));
      return NextResponse.json({ tags: fallbackTags.slice(0, 5) });
    }
    
  } catch (error) {
    console.error("Error generating tags:", error);
    return NextResponse.json({ tags: [] });
  }
}
