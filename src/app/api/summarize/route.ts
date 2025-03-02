import { pipe, OCRContent } from "@screenpipe/js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // Parse the request body to get the time parameter
    const body = await request.json();
    const time = body.time || [5]; // Default to 5 minutes if not specified
    const timeVal = time[0];
    
    // Calculate the timestamp for the requested time period
    const minutesAgo = new Date(Date.now() - timeVal * 60 * 1000).toISOString();
    
    // Query ScreenPipe for data
    const results = await pipe.queryScreenpipe({
      startTime: minutesAgo,
      limit: 10,
      contentType: "all",
    });

    // Ensure results.data exists and is an array
    if (!results || !results.data || !Array.isArray(results.data)) {
      throw new Error("Unexpected response format");
    }

    // Filter for OCR items only
    const ocrItems = results.data.filter(
      (item) => item.type === "OCR"
    ) as Array<{type:"OCR"; content:OCRContent}>;

    // Combine OCR text
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