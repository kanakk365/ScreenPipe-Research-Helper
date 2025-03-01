import { pipe , OCRContent } from "@screenpipe/js";
import { NextResponse } from "next/server";


export async function POST(request: Request) {
  try {
    const {time} = await request.json()
    const timeVal = time[0]
    const oneMinutesAgo = new Date(Date.now() - timeVal * 60 * 1000).toISOString();
    const results = await pipe.queryScreenpipe({
      startTime: oneMinutesAgo,
      limit: 10,
      contentType: "all",
    });
 console.log(timeVal)
    console.log(results?.data.map((d) => d.content));

    // Ensure results.data exists and is an array
    if (!results || !results.data || !Array.isArray(results.data)) {
      throw new Error("Unexpected response format");
    }

    // Filter for OCR items with a type predicate so TypeScript understands the structure
    const ocrItems = results.data.filter(
      (item) =>
        item.type === "OCR"
    )as Array<{type:"OCR" ; content:OCRContent}>;

    const combinedText = ocrItems
      .map((r) => r.content.text || "")
      .join("\n");

    return NextResponse.json({ text: combinedText });
  } catch (error) {
    console.error("Error querying screen data:", error);
    return NextResponse.json(
      { error: "Failed to retrieve screen data" },
      { status: 500 }
    );
  }
}