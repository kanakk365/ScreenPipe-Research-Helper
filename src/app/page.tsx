"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

interface SummaryEntry {
  text: string;
  timestamp: string;
}

export default function Home() {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [topic, setTopic] = useState("");
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [summaryArr, setSummaryArr] = useState<SummaryEntry[]>([]);
  const [sliderValue, setSliderValue] = useState<number[]>([50]);

  const max = 10;
  const skipInterval = 1;
  const ticks = [...Array(max + 1)].map((_, i) => i);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (autoRefresh) {
      // Initial fetch when auto-refresh is turned on
      fetchSummary();

      // Set up interval for subsequent fetches (every minute)
      intervalId = setInterval(() => {
        fetchSummary();
      }, sliderValue[0]); // 60000 ms = 1 minute
    }

    // Clean up the interval when the component unmounts or autoRefresh changes
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh]);

  const fetchSummary = async () => {
    setLoading(true);
    setSummary("");
    try {
      // Step 1: Query recent screen text
      const res = await fetch("/api/summarize", { method: "POST", body:JSON.stringify({time: sliderValue}) });
      const data = await res.json();

      // Step 2: Send text to the summarization API route
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: data.text, topic: topic }),
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

      // Only add the final completed summary to our array
      if (finalResult) {
        const newEntry: SummaryEntry = {
          text: finalResult,
          timestamp: new Date().toLocaleString(),
        };
        // Add the new summary at the beginning of the array
        setSummaryArr((prev) => [newEntry, ...prev]);
      }
    } catch (error) {
      console.error("Error fetching summary:", error);
      setSummary("Failed to generate summary.");
      // If there's an error, turn off auto-refresh to prevent continuous errors
      setAutoRefresh(false);
    }
    setLoading(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setTopic(e.target.value);
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  return (
    <main className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Research Assistant</h1>
      <Input
        onChange={(e) => handleInputChange(e)}
        placeholder="Enter the topic you want to study"
      />
      <div className="flex gap-2">
        <Button
          onClick={autoRefresh ? toggleAutoRefresh : fetchSummary}
          disabled={loading}
          className={autoRefresh ? "bg-red-600 hover:bg-red-700" : ""}
        >
          {loading
            ? "Summarizing..."
            : autoRefresh
            ? "Stop Auto-Refresh"
            : "Start Summary"}
        </Button>
        {!autoRefresh && !loading && (
          <Button onClick={toggleAutoRefresh} variant="outline">
            Enable Auto-Refresh {sliderValue[0]} min
          </Button>
        )}
        <div className="space-y-4 min-w-[300px]">
          <Label>Pick the the summary interval (min) </Label>
          <div>
            <Slider
            onValueChange={(newValue)=>{
              setSliderValue(newValue)
              console.log(sliderValue)
            }}
              defaultValue={[5]}
              max={max}
              aria-label="Slider with ticks"
            />
            <span
              className="mt-3 flex w-full items-center justify-between gap-1 px-2.5 text-xs font-medium text-muted-foreground"
              aria-hidden="true"
            >
              {ticks.map((_, i) => (
                <span
                  key={i}
                  className="flex w-0 flex-col items-center justify-center gap-2"
                >
                  <span
                    className={cn(
                      "h-1 w-px bg-muted-foreground/70",
                      i % skipInterval !== 0 && "h-0.5"
                    )}
                  />
                  <span className={cn(i % skipInterval !== 0 && "opacity-0")}>
                    {i}
                  </span>
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>
      {autoRefresh && !loading && (
        <div className="text-sm text-green-600 animate-pulse">
          Auto-refreshing every minute. Next update in less than 60 seconds.
        </div>
      )}

      {loading && (
        <div className="border p-4 rounded bg-gray-50">
          <h2 className="font-semibold mb-2">Processing...</h2>
          <p>{summary}</p>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="font-bold text-xl mt-4">Summary History</h2>
        {summaryArr.length > 0 ? (
          summaryArr.map((entry, index) => (
            <div key={index} className="border p-4 rounded shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium">
                  Summary #{summaryArr.length - index}
                </h3>
                <span className="text-sm text-gray-500">{entry.timestamp}</span>
              </div>
              <p className="whitespace-pre-wrap">{entry.text}</p>
            </div>
          ))
        ) : (
          <p className="text-gray-500">
            No summaries yet. Click &quot;Start Summary&quot; to begin.
          </p>
        )}
      </div>
    </main>
  );
}
