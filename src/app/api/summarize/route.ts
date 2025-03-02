import { pipe, OCRContent } from "@screenpipe/js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {

    const body = await request.json();
    const time = body.time || [5];
    const timeVal = time[0];
    
   
    const minutesAgo = new Date(Date.now() - timeVal * 60 * 1000).toISOString();
    

    const results = await pipe.queryScreenpipe({
      startTime: minutesAgo,
      limit: 10,
      contentType: "all",
    });


    if (!results || !results.data || !Array.isArray(results.data)) {
      throw new Error("Unexpected response format");
    }


    const ocrItems = results.data.filter(
      (item) => item.type === "OCR"
    ) as Array<{type:"OCR"; content:OCRContent}>;

 
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