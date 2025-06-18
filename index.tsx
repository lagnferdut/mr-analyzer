
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

interface MarketingAnalysis {
    insights: string[];
    recommendations: string[];
}

const App: React.FC = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [analysisResult, setAnalysisResult] = useState<MarketingAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [apiKeyExists, setApiKeyExists] = useState<boolean>(false);

    useEffect(() => {
        // This check runs in the browser. For 'process.env.API_KEY' to be available here,
        // it typically needs to be made available by your hosting platform (e.g., Railway)
        // to the client-side code, often during a build/deployment process.
        const keyFromEnv = process.env.API_KEY;

        if (keyFromEnv && keyFromEnv.trim() !== "") {
            setApiKeyExists(true);
            // Clear any initial API key related error if key is found
             setError(prevError => (prevError && (prevError.includes("API Key is not configured") || prevError.includes("API Key is not configured"))) ? null : prevError);
        } else {
            console.warn("API_KEY environment variable is not set or not accessible in the frontend JavaScript environment. If deploying to a platform like Railway, ensure the API_KEY variable is correctly set in your service's environment variables AND that your build/deployment process makes it available to the client-side code (e.g., as process.env.API_KEY).");
            setError("API Key is not configured for use in the browser. Please ensure the API_KEY environment variable is set in your deployment platform (e.g., Railway) and made available to the frontend application.");
            setApiKeyExists(false);
        }
    }, []);

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

        if (!apiKeyExists) {
            setError("API Key is not configured or available in the browser. Cannot perform analysis. Please check your application's API key setup and deployment configuration on Railway.");
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);

        try {
            // apiKeyExists is true, so we assume process.env.API_KEY is populated.
            // The Gemini SDK guidelines require using process.env.API_KEY directly.
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

            const fileName = selectedFile.name;
            const prompt = `
You are a marketing analysis expert.
Analyze a typical marketing report. Assume the report shows mixed results: some campaigns are successful, but overall engagement is declining.
The report is named: "${fileName}".

Provide your analysis in JSON format. The JSON object must have two keys: "insights" and "recommendations".
Each key must have a value that is an array of strings, where each string is a bullet point.
For example:
{
  "insights": [
    "Insight 1 regarding typical marketing data.",
    "Insight 2 regarding typical marketing data."
  ],
  "recommendations": [
    "Recommendation 1 based on typical insights.",
    "Recommendation 2 based on typical insights."
  ]
}
Ensure the output is only the JSON object, without any surrounding text or markdown.`;

            const response: GenerateContentResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-04-17",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                }
            });

            let jsonStr = response.text.trim();
            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonStr.match(fenceRegex);
            if (match && match[2]) {
                jsonStr = match[2].trim();
            }
            
            try {
                const parsedData: MarketingAnalysis = JSON.parse(jsonStr);
                if (parsedData && Array.isArray(parsedData.insights) && Array.isArray(parsedData.recommendations)) {
                   setAnalysisResult(parsedData);
                } else {
                    throw new Error("Invalid JSON structure received from API.");
                }
            } catch (e) {
                console.error("Failed to parse JSON response:", e, "\nReceived string:", jsonStr);
                setError(`Failed to parse analysis data. Raw response: ${jsonStr.substring(0, 200)}...`);
                setAnalysisResult(null);
            }

        } catch (err) {
            console.error("Error during analysis:", err);
            setError(err instanceof Error ? err.message : "An unknown error occurred during analysis.");
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
                         <span className="file-input-label">Click to upload or drag and drop your report</span>
                         <span className="file-name" aria-live="polite">
                            {selectedFile ? selectedFile.name : "Supported files: PDF, CSV, Excel"}
                         </span>
                    </label>
                    <input
                        type="file"
                        id="file-upload"
                        accept=".pdf,.csv,.xls,.xlsx,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={handleFileChange}
                        aria-describedby="file-type-info"
                    />
                     <p id="file-type-info" className="sr-only">Supported file types are PDF, CSV, XLS, and XLSX.</p>

                    <button onClick={handleAnalyze} disabled={!selectedFile || isLoading || !apiKeyExists}>
                        {isLoading ? "Analyzing..." : "Analyze Report"}
                    </button>
                </section>

                {isLoading && <div className="loading-indicator" aria-busy="true">Loading analysis...</div>}
                {error && <div className="error-message" role="alert">{error}</div>}

                {analysisResult && (
                    <div className="results-container">
                        <section className="results-section" aria-labelledby="insights-heading">
                            <h2 id="insights-heading">Insights</h2>
                            {analysisResult.insights.length > 0 ? (
                                <ul>
                                    {analysisResult.insights.map((insight, index) => (
                                        <li key={`insight-${index}`}>{insight}</li>
                                    ))}
                                </ul>
                            ) : <p>No insights generated.</p>}
                        </section>

                        <section className="results-section" aria-labelledby="recommendations-heading">
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
                 <style>{`
                    .sr-only {
                        position: absolute;
                        width: 1px;
                        height: 1px;
                        padding: 0;
                        margin: -1px;
                        overflow: hidden;
                        clip: rect(0, 0, 0, 0);
                        white-space: nowrap;
                        border-width: 0;
                    }
                `}</style>
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
