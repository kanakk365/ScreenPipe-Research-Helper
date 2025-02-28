"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const fetchSummary = async () => {
    setLoading(true);
    setSummary("");
    try {
      // Step 1: Query recent screen text
      const res = await fetch("/api/summarize", { method: "POST" });
      const data = await res.json();

      // Step 2: Send text to the summarization API route
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: data.text }),
      });

      // Read and process the streamed response
      if (!analyzeRes.body) {
        throw new Error("No response body");
      }
      
      const reader = analyzeRes.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let finalResult = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Append the new chunk to the buffer string
        buffer += decoder.decode(value, { stream: true });
        // Split buffer into lines; each line ideally is a valid JSON object
        const lines = buffer.split("\n");
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            // Extract the incremental content if available
            const chunkContent = parsed.choices?.[0]?.delta?.content || "";
            finalResult += chunkContent;
            setSummary(finalResult);
          } catch (error) {
            console.error("Error parsing chunk:", error);
          }
        }
      }

      // Process any remaining text in the buffer
      try {
        if (buffer.trim()) {
          const parsed = JSON.parse(buffer);
          const chunkContent = parsed.choices?.[0]?.delta?.content || "";
          finalResult += chunkContent;
          setSummary(finalResult);
        }
      } catch (error) {
        console.error("Error parsing final buffer:", error);
      }
    } catch (error) {
      console.error("Error fetching summary:", error);
      setSummary("Failed to generate summary.");
    }
    setLoading(false);
  };

  return (
    <main className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Research Summarizer</h1>
      <Button onClick={fetchSummary} disabled={loading}>
        {loading ? "Summarizing..." : "Generate Summary"}
      </Button>
      {summary && (
        <div className="border p-4 rounded">
          <h2 className="font-semibold mb-2">Summary:</h2>
          <p>{summary}</p>
        </div>
      )}
    </main>
  );
}
