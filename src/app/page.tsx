"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ResearchActivity from "@/components/ResearchActivity";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface SummaryEntry {
  text: string;
  timestamp: string;
  id: string;
  topic: string;
  tags?: string[];
  notes?: string;
}

export default function Home() {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [topic, setTopic] = useState("");
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [summaryArr, setSummaryArr] = useState<SummaryEntry[]>([]);
  const [sliderValue, setSliderValue] = useState<number[]>([5]);
  const [activeTab, setActiveTab] = useState("summaries");
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredSummaries, setFilteredSummaries] = useState<SummaryEntry[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [extractedEntities, setExtractedEntities] = useState<{[key: string]: number}>({});
  const summaryIdCounter = useRef(0);
  const [fullSummary, setFullSummary] = useState<string>("");
  const [fullSummaryLoading, setFullSummaryLoading] = useState<boolean>(false);
  const [fullSummaryDialogOpen, setFullSummaryDialogOpen] = useState<boolean>(false);

  const max = 10;
  const ticks = [...Array(max + 1)].map((_, i) => i);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (autoRefresh) {
      fetchSummary();
      intervalId = setInterval(() => {
        fetchSummary();
      }, sliderValue[0] * 60000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh, sliderValue ]);

  useEffect(() => {
    let filtered = [...summaryArr];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(summary => 
        summary.text.toLowerCase().includes(term) || 
        summary.topic.toLowerCase().includes(term)
      );
    }
    
    if (selectedTags.length > 0) {
      filtered = filtered.filter(summary => 
        summary.tags?.some(tag => selectedTags.includes(tag))
      );
    }
    
    setFilteredSummaries(filtered);
  }, [summaryArr, searchTerm, selectedTags]);

  useEffect(() => {
    if (summaryArr.length > 0) {
      const extractEntities = async () => {
        try {
          const res = await fetch("/api/extract-entities", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              summaries: summaryArr.map(s => s.text).join("\n\n") 
            }),
          });
          
          const data = await res.json();
          setExtractedEntities(data.entities || {});
        } catch (error) {
          console.error("Error extracting entities:", error);
        }
      };
      
      extractEntities();
    }
  }, [summaryArr]);

  const fetchSummary = async () => {
    setLoading(true);
    setSummary("");
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time: sliderValue }),
      });
      const data = await res.json();

      const recentSummaries = summaryArr.slice(0, 3);

      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: data.text, 
          topic: topic,
          previousSummaries: recentSummaries
        }),
      });

      if (!analyzeRes.body) {
        throw new Error("No response body received");
      }

      const reader = analyzeRes.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let finalResult = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            const chunkContent = parsed.choices?.[0]?.delta?.content || "";
            finalResult += chunkContent;
            setSummary(finalResult);
          } catch (error) {
            console.error("Error parsing chunk:", error);
          }
        }
      }

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

      if (finalResult) {
        const tagsRes = await fetch("/api/generate-tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: finalResult, topic }),
        });
        
        const tagsData = await tagsRes.json();
        
        const newEntry: SummaryEntry = {
          text: finalResult,
          timestamp: new Date().toLocaleString(),
          id: `summary-${summaryIdCounter.current++}`,
          topic,
          tags: tagsData.tags || [],
          notes: ""
        };
        setSummaryArr((prev) => [newEntry, ...prev]);
      }
    } catch (error) {
      console.error("Error fetching summary:", error);
      setSummary("Sorry, we encountered an issue generating your summary.");
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

  const addNote = (summaryId: string, note: string) => {
    setSummaryArr(prev => prev.map(summary => {
      if (summary.id === summaryId) {
        return {...summary, notes: note};
      }
      return summary;
    }));
  };

  const exportSummaries = () => {
    const content = summaryArr.map(summary => (
      `# ${summary.topic} - ${summary.timestamp}\n\n` +
      `${summary.text}\n\n` +
      `${summary.notes ? `Notes: ${summary.notes}\n\n` : ''}` +
      `Tags: ${summary.tags?.join(', ') || 'None'}\n\n` +
      `---\n\n`
    )).join('');
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research-summary-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateFullSummary = async () => {
    if (summaryArr.length < 2) {
      alert("You need at least 2 summaries to generate a comprehensive report.");
      return;
    }
    
    setFullSummaryLoading(true);
    setFullSummary("");
    setFullSummaryDialogOpen(true);
    
    try {
      const analyzeRes = await fetch("/api/generate-full-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          allSummaries: summaryArr
        }),
      });

      if (!analyzeRes.body) {
        throw new Error("No response body received");
      }

      const reader = analyzeRes.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let finalResult = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            const chunkContent = parsed.choices?.[0]?.delta?.content || "";
            finalResult += chunkContent;
            setFullSummary(finalResult);
          } catch (error) {
            console.log(error)
            finalResult += line + "\n";
            setFullSummary(finalResult);
          }
        }
      }

      try {
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer);
            const chunkContent = parsed.choices?.[0]?.delta?.content || "";
            finalResult += chunkContent;
          } catch (error) {
            console.log(error)
            finalResult += buffer;
          }
          setFullSummary(finalResult);
        }
      } catch (error) {
        console.error("Error parsing final buffer:", error);
      }
    } catch (error) {
      console.error("Error generating full summary:", error);
      setFullSummary("Sorry, we encountered an issue generating your comprehensive summary.");
    } finally {
      setFullSummaryLoading(false);
    }
  };

  const exportFullSummary = () => {
    if (!fullSummary) return;
    
    const content = `# Comprehensive Research Summary\n\n${fullSummary}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comprehensive-research-summary-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-6 bg-white shadow-md rounded-lg">
      <header className="text-center">
        <h1 className="text-3xl font-bold mb-2">Research Assistant</h1>
        <p className="text-gray-600">
          Analyze your screen activity to generate comprehensive research insights
        </p>
      </header>

      <section className="space-y-4">
        <Input
          onChange={handleInputChange}
          placeholder="Enter a research topic..."
          className="w-full p-3 border rounded-md"
        />

        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <Button
            onClick={autoRefresh ? toggleAutoRefresh : fetchSummary}
            disabled={loading}
            className={`w-full md:w-auto ${
              autoRefresh ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading
              ? "Summarizing..."
              : autoRefresh
              ? "Stop Auto-Refresh"
              : "Generate Summary"}
          </Button>
          {!autoRefresh && !loading && (
            <Button onClick={toggleAutoRefresh} variant="outline" className="w-full md:w-auto">
              Enable Auto-Refresh ({sliderValue[0]} min)
            </Button>
          )}

          <div className="flex-1">
            <Label className="block mb-1 font-medium">Summary Interval (minutes)</Label>
            <Slider
              onValueChange={(newValue) => {
                setSliderValue(newValue);
                console.log("Interval:", newValue);
              }}
              defaultValue={[5]}
              max={max}
              aria-label="Slider with ticks"
            />
            <div className="mt-2 flex justify-between text-xs text-gray-500 px-2">
              {ticks.map((tick, i) => (
                <span key={i}>{tick}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={exportSummaries} variant="outline" size="sm">
            Export All Summaries
          </Button>
        </div>
      </section>

      <Tabs defaultValue="summaries" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="summaries">Summaries</TabsTrigger>
          <TabsTrigger value="insights">Research Insights</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        
        <TabsContent value="summaries" className="space-y-4">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div className="flex-1">
              <Input 
                placeholder="Search summaries..." 
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            
            {summaryArr.length >= 2 && (
              <Button
                onClick={generateFullSummary}
                disabled={fullSummaryLoading}
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
              >
                {fullSummaryLoading ? (
                  <>Generating<span className="animate-pulse">...</span></>
                ) : (
                  <>Generate Complete Report</>
                )}
              </Button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {Array.from(new Set(summaryArr.flatMap(s => s.tags || []))).map(tag => (
              <Badge 
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  setSelectedTags(prev => 
                    prev.includes(tag) 
                      ? prev.filter(t => t !== tag) 
                      : [...prev, tag]
                  );
                }}
              >
                {tag}
              </Badge>
            ))}
          </div>
          
          {summaryArr.length >= 2 && (
            <div className="bg-gray-50 p-3 rounded-md mb-2 text-sm">
              <p className="text-gray-600">
                You have <span className="font-medium">{summaryArr.length}</span> research summaries across{" "}
                <span className="font-medium">{new Set(summaryArr.map(s => s.topic)).size}</span> topics.
                <span className="ml-1 text-blue-600 hover:underline cursor-pointer" onClick={generateFullSummary}>
                  Generate a comprehensive report
                </span>
              </p>
            </div>
          )}
          
          {(searchTerm || selectedTags.length > 0 ? filteredSummaries : summaryArr).map((entry) => (
            <Card key={entry.id} className="mb-4">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">{entry.topic}</CardTitle>
                  <span className="text-sm text-gray-500">{entry.timestamp}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {entry.tags?.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-gray-800">{entry.text}</p>
              </CardContent>
              <CardFooter className="flex-col items-start gap-2 pt-2">
                <Input
                  placeholder="Add notes..."
                  value={entry.notes || ""}
                  onChange={(e) => addNote(entry.id, e.target.value)}
                  className="w-full"
                />
              </CardFooter>
            </Card>
          ))}
          
          {summaryArr.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>Start generating summaries to see your research insights here.</p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="insights">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Key Concepts</CardTitle>
                <CardDescription>Frequent topics in your research</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(extractedEntities)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 15)
                    .map(([entity, count]) => (
                    <Badge key={entity} className="text-sm py-1">
                      {entity} <span className="ml-1 opacity-70">({count})</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Research Activity</CardTitle>
                <CardDescription>Your research patterns over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResearchActivity summaryData={summaryArr} />
              </CardContent>
            </Card>
            
            {summaryArr.length > 2 && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Research Progress</CardTitle>
                  <CardDescription>Development of your research over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative overflow-hidden pt-3">
                    <div className="absolute top-0 left-0 w-full h-2 flex">
                      {summaryArr.map((_, idx) => (
                        <div
                          key={idx}
                          className="flex-1 h-full border-r border-white last:border-r-0"
                          style={{
                            backgroundColor: `hsl(${210 + (idx * 30) % 150}, 80%, 60%)`,
                          }}
                        ></div>
                      ))}
                    </div>
                    <div className="pt-3 text-sm text-gray-600">
                      Your research has evolved through {summaryArr.length} iterations, 
                      covering {new Set(summaryArr.map(s => s.topic)).size} distinct topics.
                      {summaryArr.length > 5 && (
                        <span> You&apos;ve been consistently tracking this research for 
                          {Math.round((new Date().getTime() - new Date(summaryArr[summaryArr.length-1].timestamp).getTime()) / (1000 * 60 * 60 * 24))} days.
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="md:col-span-2 mb-4">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Research Synthesis</span>
                  <Button 
                    onClick={generateFullSummary}
                    disabled={summaryArr.length < 2 || fullSummaryLoading}
                    variant="outline"
                    size="sm"
                    className="ml-4"
                  >
                    {fullSummaryLoading ? (
                      <>Generating Summary<span className="animate-pulse">...</span></>
                    ) : (
                      <>Generate Complete Research Report</>
                    )}
                  </Button>
                </CardTitle>
                <CardDescription>
                  Generate a comprehensive synthesis of all your research insights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  This feature analyzes all your {summaryArr.length} summaries across {new Set(summaryArr.map(s => s.topic)).size} topics to create a comprehensive report. 
                  Perfect for creating final research documentation.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="timeline">
          <div className="space-y-4">
            <div className="border-l-2 border-gray-200 ml-4 pl-8 space-y-8">
              {summaryArr.map((entry) => (
                <div key={entry.id} className="relative">
                  <div className="absolute -left-10 mt-1 rounded-full bg-blue-500 w-4 h-4"></div>
                  <div>
                    <p className="text-sm text-gray-500">{entry.timestamp}</p>
                    <h3 className="font-medium">{entry.topic}</h3>
                    <p className="mt-1 line-clamp-3">{entry.text}</p>
                  </div>
                </div>
              ))}
            </div>
            
            {summaryArr.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>Your research timeline will appear here</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={fullSummaryDialogOpen} onOpenChange={setFullSummaryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comprehensive Research Summary</DialogTitle>
            <DialogDescription>
              A synthesis of all your research insights across {new Set(summaryArr.map(s => s.topic)).size} topics
            </DialogDescription>
          </DialogHeader>
          
          {fullSummaryLoading ? (
            <div className="p-8 text-center">
              <div className="animate-pulse mb-4">Generating comprehensive research synthesis...</div>
              <div className="h-3 bg-gray-200 rounded-full w-3/4 mx-auto mb-2"></div>
              <div className="h-3 bg-gray-200 rounded-full w-full mx-auto mb-2"></div>
              <div className="h-3 bg-gray-200 rounded-full w-2/3 mx-auto mb-2"></div>
            </div>
          ) : (
            <div className="prose prose-blue max-w-none">
              <div className="whitespace-pre-wrap" 
                dangerouslySetInnerHTML={{ 
                  __html: fullSummary
                    .replace(/\n\n/g, '<br/><br/>') 
                    .replace(/\n/g, '<br/>') 
                    .replace(/#{2,6} (.*?)(<br\/>|$)/g, (match, heading) => 
                      `<strong class="text-lg font-bold block mt-4 mb-2">${heading}</strong>`) 
                }} 
              />
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setFullSummaryDialogOpen(false)}>
              Close
            </Button>
            <Button 
              onClick={exportFullSummary}
              disabled={!fullSummary || fullSummaryLoading}
            >
              Export as Markdown
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
