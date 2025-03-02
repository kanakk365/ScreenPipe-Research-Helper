# Research Assistant

An AI-powered application that transforms your screen activity into structured research insights. Research Assistant continuously analyzes what you're reading and working on, generating comprehensive summaries and knowledge connections to enhance your research workflow.

![Research Assistant Screenshot](https://github.com/user-attachments/assets/9f022247-e8f9-4394-95fa-2ab17626de26)

## Features
![Research Assistant Insights](https://github.com/user-attachments/assets/c04a522a-2a00-42da-b87f-37c8b7caa58a)



![Screenshot 2025-03-02 163318](https://github.com/user-attachments/assets/7b308717-cc60-4525-b8a8-f5814535f581)

- **Automated Screen Analysis**: Captures and summarizes text from your screen activity
- **Topic-Based Organization**: Group research by customizable topics
- **Real-time Summarization**: Generate concise, well-structured summaries
- **Auto-refresh**: Set intervals (1-10 minutes) to automatically generate new summaries
- **Interactive Insights Dashboard**: Visualize research patterns and key concepts
- **Timeline View**: Track the evolution of your research over time
- **Tag Generation & Filtering**: AI-generated tags to categorize and filter content
- **Research Synthesis**: Generate comprehensive reports across all your summaries
- **Markdown Export**: Export individual summaries or comprehensive reports

## Technical Implementation

- **Frontend**: React with TypeScript, using shadcn/ui components
- **AI Analysis**: Hybrid approach using:
  - GPT-3.5 Turbo for initial analysis (cost optimization)
  - GPT-4 for final synthesis (higher quality)
- **Data Visualization**: Canvas-based activity tracking
- **Screen Capture**: Integration with ScreenPipe JS SDK
- **Streaming Responses**: Real-time summary generation with streamed AI responses

## How It Works

1. **Capture**: The app captures text from your screen activity
2. **Analyze**: AI processes the text, identifying key concepts and insights
3. **Synthesize**: Content is summarized and organized by topic
4. **Present**: Results are displayed in an interactive dashboard
5. **Connect**: Related concepts are linked across different summaries

## Usage

1. Enter your research topic
2. Click "Generate Summary" to analyze current screen content
3. Enable auto-refresh for continuous monitoring
4. Use the insights tab to discover patterns and connections
5. Generate comprehensive reports when needed
6. Export your research as Markdown files

## AI Cost Optimization

The application uses a hybrid approach to optimize OpenAI API costs:
- Initial chunking and processing: GPT-3.5 Turbo (~95% cheaper)
- Final synthesis: GPT-4 (for higher quality output)
- This balance provides high-quality results while minimizing API expenses

## Demo

https://github.com/user-attachments/assets/fe2acbb1-ee13-458b-a049-b21131c29e00


## Requirements

- ScreenPipe application installed
- OpenAI API key configured in ScreenPipe settings

## Future Development

- Local LLM support (coming soon)
- Collaborative research capabilities
- Advanced data visualization options
- Enhanced entity recognition and relationship mapping

---

Built with [ScreenPipe](https://screenpipe.com) technology



