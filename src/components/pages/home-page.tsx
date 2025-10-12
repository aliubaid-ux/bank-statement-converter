"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileUp,
  Loader,
  CheckCircle2,
  AlertTriangle,
  Download,
  FileJson,
  FileSpreadsheet,
  Table,
  RotateCcw,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import Tesseract from "tesseract.js";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Status =
  | "idle"
  | "dragging"
  | "reading"
  | "parsing-text"
  | "parsing-ocr"
  | "processing"
  | "success"
  | "error";

// This type is now a generic array of strings, representing a row.
type RowData = string[];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// New simpler parser that respects columns based on spacing.
function parseTextToRows(text: string): RowData[] {
  const rows: RowData[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.trim().length === 0) continue;

    // Split by 2 or more spaces to identify columns
    const columns = line.split(/\s{2,}/).map(col => col.trim());
    if (columns.length > 1) {
        rows.push(columns);
    } else if (columns.length === 1 && columns[0]) {
        // Keep single-column lines if they contain content
        rows.push(columns);
    }
  }

  return rows;
}


export function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [extractedData, setExtractedData] = useState<RowData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  }, []);
  
  const resetState = useCallback(() => {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setExtractedData([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleFile = useCallback(async (selectedFile: File | null) => {
    if (!selectedFile) return;

    if (selectedFile.type !== "application/pdf") {
      setError("Invalid file type. Please upload a PDF.");
      setStatus("error");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(
        `File is too large (${(selectedFile.size / 1024 / 1024).toFixed(
          2
        )} MB). Maximum size is 20 MB.`
      );
      setStatus("error");
      return;
    }

    setFile(selectedFile);
    setStatus("reading");
    setError(null);
    setProgress(0);

    try {
      const reader = new FileReader();
      reader.readAsArrayBuffer(selectedFile);
      reader.onload = async (e) => {
        if (!e.target?.result) {
          setError("Failed to read file.");
          setStatus("error");
          return;
        }

        const typedarray = new Uint8Array(e.target.result as ArrayBuffer);

        setStatus("parsing-text");
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let fullText = "";
        
        let extractedItems = 0;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          extractedItems += textContent.items.length;
          fullText += textContent.items.map((item: any) => item.str).join("\n");
        }
        
        // Preserve line breaks for the new parser
        fullText = fullText.replace(/\r/g, '');

        if (fullText.trim().length < 100 || extractedItems < 10) {
          setStatus("parsing-ocr");
          let ocrText = "";
          const worker = await Tesseract.createWorker({
            logger: (m) => {
              if (m.status === "recognizing text") {
                setProgress(m.progress * 100);
              }
            },
          });
          
          await worker.load();
          await worker.loadLanguage('eng');
          await worker.initialize('eng');
          // Important: Tell Tesseract to preserve inter-word spaces to help identify columns
          await worker.setParameters({
              tessedit_pageseg_mode: Tesseract.PSM.AUTO,
              preserve_interword_spaces: '1',
          });

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d")!;
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport }).promise;
            const {
              data: { text },
            } = await worker.recognize(canvas);
            ocrText += text;
          }
          await worker.terminate();
          fullText = ocrText;
        }

        setStatus("processing");
        const result = parseTextToRows(fullText);
        
        if (result && result.length > 0) {
            setExtractedData(result);
            setStatus("success");
        } else {
            setError("No data could be extracted. The document might be empty or in an unsupported format.");
            setStatus("error");
        }
      };
    } catch (err: any)
    {
      console.error(err);
      setError(err.message || "An unexpected error occurred during processing.");
      setStatus("error");
    }
  }, []);

  const handleExport = useCallback(
    (format: "xlsx" | "csv" | "json") => {
      if (extractedData.length === 0) return;

      const worksheet = XLSX.utils.aoa_to_sheet(extractedData);

      if (format === "json") {
        const dataStr = JSON.stringify(extractedData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${file?.name.replace(".pdf", "")}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
      XLSX.writeFile(
        workbook,
        `${file?.name.replace(".pdf", "")}.${format}`
      );
    },
    [extractedData, file]
  );

  const statusInfo: Record<Status, { icon: React.ReactNode; text: string }> = {
    idle: { icon: null, text: "" },
    dragging: { icon: null, text: "" },
    reading: { icon: <Loader className="animate-spin" />, text: "Reading file..." },
    "parsing-text": { icon: <Loader className="animate-spin" />, text: "Extracting text..." },
    "parsing-ocr": { icon: <Loader className="animate-spin" />, text: "Performing OCR..." },
    processing: { icon: <Loader className="animate-spin" />, text: "Parsing data..." },
    success: { icon: <CheckCircle2 className="text-green-500" />, text: "Processing complete!" },
    error: { icon: <AlertTriangle className="text-destructive" />, text: "An error occurred." },
  };

  const isProcessing = ["reading", "parsing-text", "parsing-ocr", "processing"].includes(status);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">
            Bank Statement Converter
          </CardTitle>
          <CardDescription className="text-lg">
            Convert your PDF bank statements instantly — 100% private and secure.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <AnimatePresence mode="wait">
            {status === "idle" || status === "dragging" ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div
                  className={cn(
                    "relative flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg transition-colors",
                    status === "dragging" ? "border-primary bg-accent" : "border-border"
                  )}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={() => setStatus("dragging")}
                  onDragLeave={() => setStatus("idle")}
                  onDrop={(e) => {
                    e.preventDefault();
                    setStatus("idle");
                    handleFile(e.dataTransfer.files?.[0]);
                  }}
                >
                  <FileUp className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">
                    Drag & drop your PDF here or
                  </p>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                    className="hidden"
                    ref={fileInputRef}
                  />
                  <Button onClick={() => fileInputRef.current?.click()}>
                    Choose File
                  </Button>
                  <p className="text-xs text-muted-foreground mt-4">
                    Up to 20MB. All processing happens in your browser.
                  </p>
                </div>
              </motion.div>
            ) : isProcessing ? (
              <motion.div
                key="progress"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center"
              >
                <div className="flex items-center justify-center gap-2 text-lg font-medium mb-4">
                  {statusInfo[status].icon}
                  <span>{statusInfo[status].text}</span>
                </div>
                {(status === "parsing-ocr") && (
                  <Progress value={progress} className="w-full" />
                )}
                {file && <p className="text-muted-foreground mt-4">{file.name}</p>}
              </motion.div>
            ) : status === "success" ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 text-xl font-semibold mb-2">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                    <span>Success! Extracted {extractedData.length} rows.</span>
                  </div>
                  <p className="text-muted-foreground">{file?.name}</p>
                   <p className="text-sm text-muted-foreground mt-2">Your data is ready to be downloaded.</p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-center">Download as:</h3>
                  <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Button onClick={() => handleExport("xlsx")} size="lg">
                      <FileSpreadsheet /> Excel (.xlsx)
                    </Button>
                    <Button onClick={() => handleExport("csv")} size="lg" variant="secondary">
                      <Table /> CSV (.csv)
                    </Button>
                    <Button onClick={() => handleExport("json")} size="lg" variant="secondary">
                      <FileJson /> JSON (.json)
                    </Button>
                  </div>
                </div>
                <div className="text-center pt-4">
                   <Button onClick={resetState} variant="outline"><RotateCcw/> Convert Another File</Button>
                </div>
              </motion.div>
            ) : status === "error" ? (
               <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
               >
                <Alert variant="destructive" className="text-center">
                    <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                    <AlertTitle className="text-xl font-bold">Processing Failed</AlertTitle>
                    <AlertDescription className="mb-4">
                        {error}
                    </AlertDescription>
                    <Button onClick={resetState} variant="destructive">Try Again</Button>
                </Alert>
               </motion.div>
            ) : null}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}

    