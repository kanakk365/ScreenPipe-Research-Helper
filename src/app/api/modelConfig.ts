// Define standard models
export const MODELS = {
  // Standard models
  gpt4: "gpt-4",                // ~$0.03/1K input, $0.06/1K output 
  gpt35Turbo: "gpt-3.5-turbo",  // ~$0.0015/1K input, $0.002/1K output (95% cheaper)
  
  // Task-specific model assignments
  chunkProcessing: "gpt-3.5-turbo",  // Initial analysis
  finalSynthesis: "gpt-4",           // Final, high-quality summary
  entityExtraction: "gpt-3.5-turbo", // Entity extraction
  tagging: "gpt-3.5-turbo"           // Tag generation
};

// Helper function to estimate token count and cost
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

export function estimateCost(inputTokens: number, outputTokens: number, model: string): number {
  const rates = {
    "gpt-4": { input: 0.03, output: 0.06 },
    "gpt-3.5-turbo": { input: 0.0015, output: 0.002 }
  };
  
  const modelRates = rates[model as keyof typeof rates] || rates["gpt-3.5-turbo"];
  
  return (inputTokens * modelRates.input + outputTokens * modelRates.output) / 1000;
}

// Usage tracking (for debugging/monitoring)
export const usageStats = {
  totalTokensProcessed: 0,
  totalCost: 0,
  
  // Call this to track usage
  trackUsage(inputTokens: number, outputTokens: number, model: string) {
    this.totalTokensProcessed += (inputTokens + outputTokens);
    this.totalCost += estimateCost(inputTokens, outputTokens, model);
    
    // For debugging
    console.log(
      `API Usage - Model: ${model}, Tokens: ${inputTokens + outputTokens}, Est. Cost: $${estimateCost(inputTokens, outputTokens, model).toFixed(4)}`
    );
  }
};

// Model mapping by user tier and task
const MODEL_MAPPING = {
  standard: {
    chunkProcessing: MODELS.chunkProcessing,
    finalSynthesis: MODELS.finalSynthesis,
    entityExtraction: MODELS.entityExtraction,
    tagging: MODELS.tagging,
  },
  premium: {
    chunkProcessing: MODELS.gpt4,
    finalSynthesis: MODELS.gpt4,
    entityExtraction: MODELS.gpt4,
    tagging: MODELS.gpt4,
  }
};

// User preference (could be stored in settings)
export const userTier = "standard";

export function getModelForTask(task: keyof typeof MODEL_MAPPING.standard): string {
  // Return the model for the task based on user's tier.
  // Fallback to standard tier if the task is undefined on the user's tier.
  return MODEL_MAPPING[userTier][task] || MODEL_MAPPING.standard[task];
}
