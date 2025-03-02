import { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface ResearchActivityProps {
  summaryData: {
    id: string;
    topic: string;
    timestamp: string;
    text: string;
    tags?: string[];
  }[];
}

const ResearchActivity = ({ summaryData }: ResearchActivityProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Process data for visualization
  const processData = () => {
    if (!summaryData.length) return null;
    
    // Group summaries by day
    const byDate = summaryData.reduce((acc: Record<string, number>, item) => {
      const date = new Date(item.timestamp).toLocaleDateString();
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});
    
    // Topics frequency
    const byTopic = summaryData.reduce((acc: Record<string, number>, item) => {
      acc[item.topic] = (acc[item.topic] || 0) + 1;
      return acc;
    }, {});
    
    return {
      byDate,
      byTopic,
      total: summaryData.length,
      recentActivity: summaryData.slice(0, 5),
      oldestTimestamp: new Date(summaryData[summaryData.length - 1]?.timestamp).toLocaleDateString(),
      newestTimestamp: new Date(summaryData[0]?.timestamp).toLocaleDateString(),
    };
  };
  
  // Draw the activity chart
  useEffect(() => {
    const processedData = processData();
    const canvas = canvasRef.current;
    if (!canvas || !processedData) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set canvas dimensions
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Draw activity bars
    const dates = Object.keys(processedData.byDate).sort();
    const maxCount = Math.max(...Object.values(processedData.byDate));
    const barWidth = canvas.width / (dates.length + 1);
    const heightRatio = canvas.height / (maxCount || 1);
    
    dates.forEach((date, index) => {
      const count = processedData.byDate[date];
      const x = (index + 0.5) * barWidth;
      const height = count * heightRatio;
      const y = canvas.height - height;
      
      // Create gradient for bars
      const gradient = ctx.createLinearGradient(x, y, x, canvas.height);
      gradient.addColorStop(0, 'rgba(59, 130, 246, 0.7)'); // Blue
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0.3)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x - barWidth/3, y, barWidth/1.5, height);
      
      // Draw date labels for some bars (not all to avoid crowding)
      if (index % Math.max(1, Math.floor(dates.length / 5)) === 0) {
        ctx.fillStyle = '#6B7280'; // Gray text
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(date, x, canvas.height - 5);
      }
    });
    
    // Draw y-axis labels
    if (maxCount > 0) {
      ctx.fillStyle = '#6B7280';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      
      for (let i = 0; i <= maxCount; i += Math.max(1, Math.floor(maxCount / 4))) {
        const y = canvas.height - i * heightRatio;
        ctx.fillText(`${i}`, 5, y);
      }
    }
    
  }, [summaryData]);
  
  const data = processData();
  
  if (!data) {
    return (
      <div className="h-40 flex items-center justify-center text-gray-500">
        No data available yet
      </div>
    );
  }
  
  // Get most active topic
  const topTopic = Object.entries(data.byTopic)
    .sort((a, b) => b[1] - a[1])[0];
  
  return (
    <div className="space-y-4">
      <canvas 
        ref={canvasRef} 
        className="w-full h-40 border-b border-gray-100"
      />
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="space-y-1">
          <div className="text-gray-500">Total summaries</div>
          <div className="text-xl font-semibold">{data.total}</div>
        </div>
        
        <div className="space-y-1">
          <div className="text-gray-500">Most active topic</div>
          <div className="text-xl font-semibold truncate" title={topTopic?.[0]}>
            {topTopic ? topTopic[0] : "N/A"}
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="text-gray-500">First summary</div>
          <div>{data.oldestTimestamp}</div>
        </div>
        
        <div className="space-y-1">
          <div className="text-gray-500">Latest summary</div>
          <div>{data.newestTimestamp}</div>
        </div>
      </div>
      
      <div className="text-sm">
        <div className="text-gray-500 mb-1">Topics breakdown</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.byTopic)
            .sort((a, b) => b[1] - a[1])
            .map(([topic, count]) => (
              <div key={topic} className="px-2 py-1 bg-blue-50 rounded-md flex items-center">
                <span className="truncate max-w-[100px]" title={topic}>{topic}</span>
                <span className="ml-1 text-xs bg-blue-100 px-1 rounded">
                  {count}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default ResearchActivity;
