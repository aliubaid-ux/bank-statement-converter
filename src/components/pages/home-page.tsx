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
  Table as TableIcon,
  RotateCcw,
  Sheet,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
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
import { useToast } from "@/hooks/use-toast";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

type Status =
  | "idle"
  | "dragging"
  | "reading"
  | "parsing-text"
  | "parsing-ocr"
  | "processing"
  | "success"
  | "error";

type RowData = string[];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function parseTextItemsToRows(items: TextItem[]): RowData[] {
    if (!items || items.length === 0) {
        return [];
    }

    // Sort items by their vertical position, then horizontal
    items.sort((a, b) => {
        if (a.transform[5] > b.transform[5]) return -1;
        if (a.transform[5] < b.transform[5]) return 1;
        if (a.transform[4] < b.transform[4]) return -1;
        if (a.transform[4] > b.transform[4]) return 1;
        return 0;
    });

    const lines: TextItem[][] = [];
    let currentLine: TextItem[] = [];
    let lastY = -1;
    const Y_TOLERANCE = 5; // How close in vertical pixels items need to be to be on the same line

    for (const item of items) {
        if (item.str.trim() === '') continue;

        const currentY = item.transform[5];

        if (lastY === -1 || Math.abs(currentY - lastY) < Y_TOLERANCE) {
            currentLine.push(item);
        } else {
            if (currentLine.length > 0) {
                // Sort items on the line by their horizontal position before pushing
                lines.push(currentLine.sort((a, b) => a.transform[4] - b.transform[4]));
            }
            currentLine = [item];
        }
        lastY = currentY;
    }
    if (currentLine.length > 0) {
        lines.push(currentLine.sort((a, b) => a.transform[4] - b.transform[4]));
    }

    // This part is a heuristic to find column boundaries based on text item positions.
    const columnBoundaries: number[] = [];
    const avgCharWidth = 8; // Assumed average character width for estimating column splits

    lines.forEach(line => {
        for (let i = 0; i < line.length - 1; i++) {
            const currentItem = line[i];
            const nextItem = line[i+1];
            const gap = nextItem.transform[4] - (currentItem.transform[4] + currentItem.width);
            
            // If there's a significant gap, it's likely a new column.
            if (gap > avgCharWidth * 2) {
                const boundary = currentItem.transform[4] + currentItem.width + gap / 2;
                // Add boundary if it's not close to an existing one.
                if (!columnBoundaries.some(b => Math.abs(b - boundary) < avgCharWidth)) {
                    columnBoundaries.push(boundary);
                }
            }
        }
    });
    columnBoundaries.sort((a, b) => a - b);

    // Now, create the final rows by assigning text to columns.
    const finalRows: RowData[] = [];
    lines.forEach(line => {
        if (line.length === 0) return;

        // If there's only one item on the line, treat it as a full-width row.
        if (line.length === 1) {
            finalRows.push([line[0].str]);
            return;
        }

        const row: string[] = [];
        let currentColumnIndex = 0;
        let currentColumnText = "";

        for(const item of line) {
            if (currentColumnIndex < columnBoundaries.length && item.transform[4] > columnBoundaries[currentColumnIndex]) {
                row.push(currentColumnText.trim());
                currentColumnText = "";
                currentColumnIndex++;
                // Skip empty columns
                while (currentColumnIndex < columnBoundaries.length && item.transform[4] > columnBoundaries[currentColumnIndex]) {
                    row.push("");
                    currentColumnIndex++;
                }
            }
            currentColumnText += item.str + " ";
        }
        row.push(currentColumnText.trim());

        // Fill remaining columns if any
        while(row.length < columnBoundaries.length + 1) {
            row.push("");
        }

        if (row.some(cell => cell.trim() !== '')) {
            finalRows.push(row);
        }
    });

    return finalRows;
}


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
  const { toast } = useToast();

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
        
        let allTextItems: TextItem[] = [];
        let extractedItemsCount = 0;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          extractedItemsCount += textContent.items.length;
          allTextItems.push(...textContent.items.map(item => item as TextItem));
        }

        // If very little text was extracted, it's likely a scanned/image-based PDF.
        if (extractedItemsCount < 20) {
          setStatus("parsing-ocr");
          let fullText = "";
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
          await worker.setParameters({
              tessedit_pageseg_mode: Tesseract.PSM.AUTO,
              preserve_interword_spaces: '1',
          });

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.5 });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d")!;
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport }).promise;
            const { data: { text } } = await worker.recognize(canvas);
            fullText += text + "\n";
          }
          await worker.terminate();

          setStatus("processing");
          const result = parseTextToRows(fullText);
          if (result && result.length > 0) {
            setExtractedData(result);
            setStatus("success");
          } else {
            setError("OCR failed to extract any data. The document might be unreadable.");
            setStatus("error");
          }
        } else {
            setStatus("processing");
            const result = parseTextItemsToRows(allTextItems);
            if (result && result.length > 0) {
                setExtractedData(result);
                setStatus("success");
            } else {
                setError("No data could be extracted. The document might be empty or in an unsupported format.");
                setStatus("error");
            }
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
  
  const maxColumns = Math.max(0, ...extractedData.map(row => row.length));

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
                  <div className="flex flex-wrap justify-center gap-4">
                    <Button onClick={() => handleExport("xlsx")} size="lg">
                      <FileSpreadsheet /> Excel (.xlsx)
                    </Button>
                    <Button onClick={() => handleExport("csv")} size="lg" variant="secondary">
                      <TableIcon /> CSV (.csv)
                    </Button>
                    <Button onClick={() => handleExport("json")} size="lg" variant="secondary">
                      <FileJson /> JSON (.json)
                    </Button>
                     <Button 
                        onClick={() => toast({ title: "Coming Soon!", description: "Direct import to Google Sheets is on its way."})} 
                        size="lg" 
                        variant="secondary">
                      <Sheet /> Google Sheets
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-center">Data Preview</h3>
                    <ScrollArea className="h-72 w-full rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {Array.from({ length: maxColumns }).map((_, i) => (
                                        <TableHead key={i}>Column {i + 1}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {extractedData.map((row, rowIndex) => (
                                    <TableRow key={rowIndex}>
                                        {Array.from({ length: maxColumns }).map((_, cellIndex) => (
                                            <TableCell key={cellIndex}>{row[cellIndex] || ''}</TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
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
