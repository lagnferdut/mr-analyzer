
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
        if (process.env.API_KEY) {
            setApiKeyExists(true);
        } else {
            console.warn("API_KEY environment variable is not set. The app may not function correctly.");
            setError("Klucz API nie jest skonfigurowany. Upewnij się, że zmienna środowiskowa API_KEY jest ustawiona.");
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
                setError(`Nieprawidłowy typ pliku: ${file.type || 'nieznany'}. Proszę przesłać plik PDF, CSV lub Excel.`);
            }
        }
    };

    const handleAnalyze = async () => {
        if (!selectedFile) {
            setError("Proszę najpierw wybrać plik.");
            return;
        }

        if (!process.env.API_KEY) {
            setError("Klucz API nie jest skonfigurowany. Nie można przeprowadzić analizy.");
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);

        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                const fileDataUrl = reader.result as string;
                const base64EncodedString = fileDataUrl.substring(fileDataUrl.indexOf(',') + 1);

                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

                const filePart = {
                    inlineData: {
                        mimeType: selectedFile.type || 'application/octet-stream',
                        data: base64EncodedString,
                    },
                };

                const textPart = {
                    text: `
Jesteś ekspertem od analizy marketingowej.
Przeanalizuj dostarczone dane z raportu marketingowego. Nazwa pliku to "${selectedFile.name}".
Zawartość pliku jest dostarczona w części 'inlineData'.
Na podstawie zawartości przesłanego pliku, przedstaw swoją analizę w formacie JSON.
Proszę o przygotowanie analizy w języku polskim.

Obiekt JSON musi mieć dwa klucze: "insights" (wnioski) oraz "recommendations" (rekomendacje).
Każdy klucz musi mieć wartość będącą tablicą ciągów znaków, gdzie każdy ciąg znaków to punkt wypunktowania.
Na przykład:
{
  "insights": [
    "Wniosek 1 na podstawie dostarczonej treści pliku.",
    "Wniosek 2 na podstawie dostarczonej treści pliku."
  ],
  "recommendations": [
    "Rekomendacja 1 na podstawie dostarczonej treści pliku i wniosków.",
    "Rekomendacja 2 na podstawie dostarczonej treści pliku i wniosków."
  ]
}
Upewnij się, że dane wyjściowe to wyłącznie obiekt JSON, bez otaczającego tekstu czy formatowania markdown.
Wszystkie ciągi znaków (stringi) w tablicach "insights" i "recommendations" muszą być w języku polskim.
Jeśli zawartość pliku jest niejasna, niewystarczająca do analizy lub wydaje się uszkodzona, stwierdź, że analiza jest ograniczona przez jakość dostarczonych danych lub że plik nie mógł zostać w pełni zinterpretowany, zamiast wymyślać informacje.
Skup się wyłącznie na informacjach możliwych do uzyskania z dostarczonego pliku.
Nie wymyślaj danych.
`
                };

                const response: GenerateContentResponse = await ai.models.generateContent({
                    model: "gemini-2.5-flash-preview-04-17",
                    contents: { parts: [filePart, textPart] },
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
                        throw new Error("Nieprawidłowa struktura JSON otrzymana z API. Upewnij się, że 'insights' i 'recommendations' są tablicami.");
                    }
                } catch (e) {
                    console.error("Błąd parsowania odpowiedzi JSON:", e, "\nOtrzymany ciąg:", jsonStr);
                    setError(`Nie udało się przetworzyć danych analitycznych. Odpowiedź AI może nie być w oczekiwanym formacie JSON. Surowa odpowiedź: ${jsonStr.substring(0, 300)}...`);
                    setAnalysisResult(null);
                }

            } catch (err) {
                console.error("Błąd podczas analizy:", err);
                setError(err instanceof Error ? err.message : "Wystąpił nieznany błąd podczas analizy.");
                setAnalysisResult(null);
            } finally {
                setIsLoading(false);
            }
        };

        reader.onerror = () => {
            setError("Nie udało się odczytać pliku.");
            setIsLoading(false);
        };
        
        reader.readAsDataURL(selectedFile);
    };

    return (
        <>
            <header>
                <h1>Analizator Raportów Marketingowych</h1>
            </header>
            <main>
                <section aria-labelledby="file-upload-heading">
                    <h2 id="file-upload-heading" className="sr-only">Przesyłanie pliku</h2>
                    <label htmlFor="file-upload" className="file-input-container">
                         <span className="file-input-label">Kliknij, aby przesłać lub przeciągnij i upuść swój raport</span>
                         <span className="file-name" aria-live="polite">
                            {selectedFile ? selectedFile.name : "Obsługiwane pliki: PDF, CSV, Excel"}
                         </span>
                    </label>
                    <input
                        type="file"
                        id="file-upload"
                        accept=".pdf,.csv,.xls,.xlsx,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={handleFileChange}
                        aria-describedby="file-type-info"
                    />
                     <p id="file-type-info" className="sr-only">Obsługiwane typy plików to PDF, CSV, XLS i XLSX.</p>

                    <button onClick={handleAnalyze} disabled={!selectedFile || isLoading || !apiKeyExists}>
                        {isLoading ? "Analizowanie..." : "Analizuj Raport"}
                    </button>
                </section>

                {isLoading && <div className="loading-indicator" aria-busy="true" role="status">Ładowanie analizy...</div>}
                {error && <div className="error-message" role="alert">{error}</div>}

                {analysisResult && (
                    <div className="results-container">
                        <section className="results-section" aria-labelledby="insights-heading">
                            <h2 id="insights-heading">Wnioski</h2>
                            {analysisResult.insights.length > 0 ? (
                                <ul>
                                    {analysisResult.insights.map((insight, index) => (
                                        <li key={`insight-${index}`}>{insight}</li>
                                    ))}
                                </ul>
                            ) : <p>Brak wygenerowanych wniosków lub nie są dostępne w raporcie.</p>}
                        </section>

                        <section className="results-section" aria-labelledby="recommendations-heading">
                            <h2 id="recommendations-heading">Rekomendacje</h2>
                             {analysisResult.recommendations.length > 0 ? (
                                <ul>
                                    {analysisResult.recommendations.map((rec, index) => (
                                        <li key={`recommendation-${index}`}>{rec}</li>
                                    ))}
                                </ul>
                            ) : <p>Brak wygenerowanych rekomendacji lub nie są dostępne w raporcie.</p>}
                        </section>
                    </div>
                )}
            </main>
            <footer>
                <p>&copy; {new Date().getFullYear()} Analizator Marketingowy AI. Wspierane przez Gemini.</p>
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
    console.error("Nie znaleziono elementu root");
}
    
