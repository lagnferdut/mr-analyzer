import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, GenerateContentResponse, Type, Part } from "@google/genai";

interface MarketingAnalysis {
    isMarketingData: boolean;
    analysis?: {
        conclusions: string[];
        suggestions: string[];
        risks: string[];
        criticalErrors: string[];
    };
    reasoning?: string;
}

// Helper function to convert a File object to a GenAI Part
const fileToGenerativePart = async (file: File): Promise<Part> => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: {
            data: await base64EncodedDataPromise,
            mimeType: file.type,
        },
    };
};


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
                setError("Nieprawidłowy typ pliku. Proszę przesłać plik PDF, CSV lub Excel.");
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
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const filePart = await fileToGenerativePart(selectedFile);
            
            const prompt = `
            Twoim zadaniem jest wcielenie się w rolę doświadczonego analityka marketingowego. Otrzymujesz dokument do analizy.
            
            1.  **Ocena wstępna:** Najpierw oceń, czy załączony dokument zawiera dane, które można analizować pod kątem marketingu (np. raporty sprzedaży, wyniki kampanii, dane o ruchu na stronie, analizy social media).
            2.  **Głęboka analiza (jeśli dotyczy):** Jeśli dokument zawiera dane marketingowe, przeanalizuj je dogłębnie. Szukaj trendów, wzorców, sukcesów i porażek.
            3.  **Raportowanie:** Na podstawie analizy, wygeneruj odpowiedź JSON zgodnie z poniższym schematem.

            **Schemat odpowiedzi JSON:**

            -   **Jeśli dokument zawiera dane marketingowe:**
                -   \`isMarketingData\`: ustaw na \`true\`.
                -   \`analysis\`: wypełnij obiekt analizy:
                    -   \`conclusions\`: Podaj kluczowe, oparte na danych wnioski (np. "Kampania X przyniosła wzrost konwersji o 15%, ale kanał Y ma niski wskaźnik zaangażowania.").
                    -   \`suggestions\`: Zaproponuj konkretne, praktyczne działania (np. "Zwiększyć budżet na kampanię X o 20%", "Zoptymalizować treści dla kanału Y, aby poprawić zaangażowanie.").
                    -   \`risks\`: Zidentyfikuj potencjalne ryzyka (np. "Rosnący koszt pozyskania klienta (CAC) może zagrozić rentowności.", "Uzależnienie od jednego kanału marketingowego jest ryzykowne.").
                    -   \`criticalErrors\`: Wskaż błędy, które wymagają natychmiastowej interwencji (np. "Błąd śledzenia konwersji na stronie docelowej powoduje utratę danych.", "Wysoki wskaźnik odrzuceń na stronie cennika wskazuje na problemy z UX lub ofertą.").
            -   **Jeśli dokument NIE zawiera danych marketingowych:**
                -   \`isMarketingData\`: ustaw na \`false\`.
                -   \`reasoning\`: Podaj zwięzłe wyjaśnienie, dlaczego dokument nie nadaje się do analizy (np. "Dokument jest listą zakupów i nie zawiera danych marketingowych.", "To jest plik systemowy bez treści analitycznej.").

            Twoja odpowiedź MUSI być wyłącznie obiektem JSON zgodnym ze schematem. Nie dodawaj żadnych komentarzy ani tekstu poza obiektem JSON.`;

            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    isMarketingData: {
                        type: Type.BOOLEAN,
                        description: "Czy dokument zawiera dane marketingowe."
                    },
                    analysis: {
                        type: Type.OBJECT,
                        description: "Szczegółowa analiza, jeśli dokument jest raportem marketingowym.",
                        properties: {
                            conclusions: { type: Type.ARRAY, items: { type: Type.STRING } },
                            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                            risks: { type: Type.ARRAY, items: { type: Type.STRING } },
                            criticalErrors: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                         // Make analysis required if it is marketing data
                        required: ["conclusions", "suggestions", "risks", "criticalErrors"]
                    },
                    reasoning: {
                        type: Type.STRING,
                        description: "Wyjaśnienie, dlaczego dokument nie został uznany za raport marketingowy."
                    }
                },
                required: ["isMarketingData"]
            };

            const response: GenerateContentResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [{text: prompt}, filePart] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                }
            });

            const jsonStr = response.text.trim();
            const parsedData: MarketingAnalysis = JSON.parse(jsonStr);
            setAnalysisResult(parsedData);

        } catch (err) {
            console.error("Błąd podczas analizy:", err);
            const errorMessage = err instanceof Error ? err.message : "Wystąpił nieznany błąd podczas analizy.";
            setError(`Analiza nie powiodła się: ${errorMessage}`);
            setAnalysisResult(null);
        } finally {
            setIsLoading(false);
        }
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
                        <svg className="file-input-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3 17.25V21h18v-3.75M4.5 12.75a7.5 7.5 0 0115 0v2.25H4.5v-2.25z" />
                        </svg>
                         <span className="file-input-label">Kliknij, aby przesłać lub przeciągnij i upuść</span>
                         <span className={`file-name ${selectedFile ? 'selected' : ''}`} aria-live="polite">
                            {selectedFile ? selectedFile.name : "Wspierane formaty: PDF, CSV, Excel"}
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
                     <p id="file-type-info" className="sr-only">Wspierane typy plików to PDF, CSV, XLS oraz XLSX.</p>

                    <button 
                        onClick={handleAnalyze} 
                        disabled={!selectedFile || isLoading || !process.env.API_KEY}
                        title={!process.env.API_KEY ? "Klucz API nie jest skonfigurowany." : !selectedFile ? "Proszę najpierw wybrać plik." : ""}
                    >
                        {isLoading ? "Analizuję..." : "Analizuj Raport"}
                    </button>
                </section>

                {isLoading && (
                    <div className="loading-container" aria-busy="true">
                        <div className="loading-spinner"></div>
                        <p>AI analizuje Twój dokument...</p>
                    </div>
                )}
                
                {error && <div className="error-message" role="alert">{error}</div>}

                {analysisResult && (
                    analysisResult.isMarketingData && analysisResult.analysis ? (
                        <div className="results-container">
                            <section className="results-section conclusions" aria-labelledby="conclusions-heading">
                                <h2 id="conclusions-heading">Wnioski</h2>
                                <ul>{analysisResult.analysis.conclusions.map((item, i) => <li key={`c-${i}`}>{item}</li>)}</ul>
                            </section>
                            <section className="results-section suggestions" aria-labelledby="suggestions-heading">
                                <h2 id="suggestions-heading">Sugestie</h2>
                                <ul>{analysisResult.analysis.suggestions.map((item, i) => <li key={`s-${i}`}>{item}</li>)}</ul>
                            </section>
                            <section className="results-section risks" aria-labelledby="risks-heading">
                                <h2 id="risks-heading">Ryzyka</h2>
                                <ul>{analysisResult.analysis.risks.map((item, i) => <li key={`r-${i}`}>{item}</li>)}</ul>
                            </section>
                            <section className="results-section critical-errors" aria-labelledby="critical-errors-heading">
                                <h2 id="critical-errors-heading">Błędy Krytyczne</h2>
                                <ul>{analysisResult.analysis.criticalErrors.map((item, i) => <li key={`e-${i}`}>{item}</li>)}</ul>
                            </section>
                        </div>
                    ) : analysisResult.reasoning ? (
                         <div className="info-message" role="status">
                            <h3>Analiza nie wykazała danych marketingowych</h3>
                            <p>{analysisResult.reasoning}</p>
                        </div>
                    ) : null
                )}
            </main>
            <footer>
                <p>&copy; {new Date().getFullYear()} Analizator Marketingowy AI. Zasilany przez Gemini.</p>
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