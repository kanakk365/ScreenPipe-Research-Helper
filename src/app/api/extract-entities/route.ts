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

    const { summaries } = await request.json();
    
    // Check if we have enough content to analyze
    if (!summaries || summaries.length < 50) {
      return NextResponse.json({ entities: {} });
    }

    // Limit the amount of text sent to reduce costs (take only first 3000 chars)
    const trimmedSummaries = summaries.substring(0, 3000);

    // Use GPT-3.5-turbo for entity extraction to save costs
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Changed from GPT-4 to the cheaper model
      messages: [
        {
          role: "system",
          content: "Extract 5-15 key entities (people, concepts, technologies, theories) from the text and count their occurrences. Format response as JSON object where keys are entities and values are counts."
        },
        {
          role: "user",
          content: trimmedSummaries
        }
      ],
      temperature: 0.3,
      max_tokens: 600
    });

    // Extract the content from the response
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in response");
    }

    // Parse the JSON, with error handling for malformed JSON
    try {
      // Try to extract JSON if it's wrapped in code blocks or other text
      let jsonContent = content;
      
      // Look for JSON content between ```json and ``` markers
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonContent = jsonMatch[1];
      }
      
      // Remove any non-JSON text before or after the actual JSON object
      jsonContent = jsonContent.trim();
      if (jsonContent.indexOf('{') > 0) {
        jsonContent = jsonContent.substring(jsonContent.indexOf('{'));
      }
      if (jsonContent.lastIndexOf('}') < jsonContent.length - 1) {
        jsonContent = jsonContent.substring(0, jsonContent.lastIndexOf('}') + 1);
      }
      
      const entities = JSON.parse(jsonContent);
      return NextResponse.json({ entities });
    } catch (parseError) {
      console.error("Error parsing JSON from GPT response:", parseError);
      // Return an empty entities object as fallback
      return NextResponse.json({ entities: {} });
    }
  } catch (error) {
    console.error("Error extracting entities:", error);
    return NextResponse.json(
      { error: "Failed to extract entities" },
      { status: 500 }
    );
  }
}
