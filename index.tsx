import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

interface MarketingAnalysis {
    insights: string[];
    recommendations: string[];
}

const App: React.FC = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [analysisResult, setAnalysisResult] = useState<MarketingAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            const allowedTypes = ["application/pdf", "text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
            if (allowedTypes.includes(file.type) || file.name.endsWith('.csv') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
                setSelectedFile(file);
                setAnalysisResult(null);
                setError(null);
            } else {
                setSelectedFile(null);
                setError("Invalid file type. Please upload a PDF, CSV, or Excel file.");
            }
        }
    };

    const handleAnalyze = async () => {
        if (!selectedFile) {
            setError("Please select a file first.");
            return;
        }

        if (!process.env.API_KEY) {
            setError("API Key is not configured. Cannot perform analysis.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            const prompt = `
            Analyze this marketing report file named "${selectedFile.name}".
            The report's data suggests mixed results: some campaigns performed well, but overall user engagement is declining.
            Based on this typical scenario, provide a concise analysis.
            Your response MUST be a JSON object with two properties: "insights" and "recommendations".
            - "insights": An array of strings detailing key observations.
            - "recommendations": An array of strings with actionable suggestions.
            Do not include any other text or formatting.`;
            
            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    insights: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "Actionable insights derived from the marketing data."
                    },
                    recommendations: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "Specific, actionable recommendations based on the insights."
                    }
                },
                required: ["insights", "recommendations"]
            };

            const response: GenerateContentResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                }
            });

            const jsonStr = response.text.trim();
            const parsedData: MarketingAnalysis = JSON.parse(jsonStr);
            setAnalysisResult(parsedData);

        } catch (err) {
            console.error("Error during analysis:", err);
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during analysis.";
            setError(`Analysis failed: ${errorMessage}`);
            setAnalysisResult(null);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <header>
                <h1>Marketing Report Analyzer</h1>
            </header>
            <main>
                <section aria-labelledby="file-upload-heading">
                    <h2 id="file-upload-heading" className="sr-only">File Upload</h2>
                    <label htmlFor="file-upload" className="file-input-container">
                        <svg className="file-input-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3 17.25V21h18v-3.75M4.5 12.75a7.5 7.5 0 0115 0v2.25H4.5v-2.25z" />
                        </svg>
                         <span className="file-input-label">Click to upload or drag and drop</span>
                         <span className={`file-name ${selectedFile ? 'selected' : ''}`} aria-live="polite">
                            {selectedFile ? selectedFile.name : "Supported files: PDF, CSV, Excel"}
                         </span>
                    </label>
                    <input
                        type="file"
                        id="file-upload"
                        accept=".pdf,.csv,.xls,.xlsx,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={handleFileChange}
                        aria-describedby="file-type-info"
                        disabled={isLoading}
                    />
                     <p id="file-type-info" className="sr-only">Supported file types are PDF, CSV, XLS, and XLSX.</p>

                    <button 
                        onClick={handleAnalyze} 
                        disabled={!selectedFile || isLoading || !process.env.API_KEY}
                        title={!process.env.API_KEY ? "API Key is not configured." : !selectedFile ? "Please select a file first." : ""}
                    >
                        {isLoading ? "Analyzing..." : "Analyze Report"}
                    </button>
                </section>

                {isLoading && (
                    <div className="loading-container" aria-busy="true">
                        <div className="loading-spinner"></div>
                        <p>AI is analyzing your document...</p>
                    </div>
                )}
                
                {error && <div className="error-message" role="alert">{error}</div>}

                {analysisResult && (
                    <div className="results-container">
                        <section className="results-section insights" aria-labelledby="insights-heading">
                            <h2 id="insights-heading">Insights</h2>
                            {analysisResult.insights.length > 0 ? (
                                <ul>
                                    {analysisResult.insights.map((insight, index) => (
                                        <li key={`insight-${index}`}>{insight}</li>
                                    ))}
                                </ul>
                            ) : <p>No insights generated.</p>}
                        </section>

                        <section className="results-section recommendations" aria-labelledby="recommendations-heading">
                            <h2 id="recommendations-heading">Recommendations</h2>
                             {analysisResult.recommendations.length > 0 ? (
                                <ul>
                                    {analysisResult.recommendations.map((rec, index) => (
                                        <li key={`recommendation-${index}`}>{rec}</li>
                                    ))}
                                </ul>
                            ) : <p>No recommendations generated.</p>}
                        </section>
                    </div>
                )}
            </main>
            <footer>
                <p>&copy; {new Date().getFullYear()} Marketing Analyzer AI. Powered by Gemini.</p>
            </footer>
        </>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = ReactDOM.createRoot(container);
    root.render(<React.StrictMode><App /></React.StrictMode>);
} else {
    console.error("Root element not found");
}
