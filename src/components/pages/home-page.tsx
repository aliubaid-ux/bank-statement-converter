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
  Clipboard,
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
import { Logo } from "../icons/logo";

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

    const lines = new Map<number, TextItem[]>();
    const yTolerance = 5;

    // Group items into lines based on vertical position
    items.forEach(item => {
        if (!item.str.trim()) return;
        const y = item.transform[5];
        let found = false;
        for (const lineY of lines.keys()) {
            if (Math.abs(y - lineY) < yTolerance) {
                lines.get(lineY)!.push(item);
                found = true;
                break;
            }
        }
        if (!found) {
            lines.set(y, [item]);
        }
    });

    const sortedLines = Array.from(lines.entries()).sort((a, b) => b[0] - a[0]);

    const rows: RowData[] = [];

    sortedLines.forEach(([, lineItems]) => {
        if (lineItems.length === 0) return;

        // Sort items within the line by horizontal position
        lineItems.sort((a, b) => a.transform[4] - b.transform[4]);

        const row: string[] = [];
        let currentCell = '';
        
        // Calculate a dynamic space threshold based on average character width
        const totalWidth = lineItems.reduce((acc, item) => acc + item.width, 0);
        const totalChars = lineItems.reduce((acc, item) => acc + item.str.length, 0);
        const avgCharWidth = totalChars > 0 ? totalWidth / totalChars : 10; // Default to 10 if no chars
        const spaceThreshold = avgCharWidth * 2; // A gap of 2 characters is a new column

        for (let i = 0; i < lineItems.length; i++) {
            const item = lineItems[i];
            if (currentCell === '') {
                currentCell = item.str;
            } else {
                const prevItem = lineItems[i-1];
                const prevItemEndX = prevItem.transform[4] + prevItem.width;
                const currentItemStartX = item.transform[4];
                const gap = currentItemStartX - prevItemEndX;
                
                if (gap > spaceThreshold) {
                    row.push(currentCell.trim());
                    currentCell = item.str;
                } else {
                     // If gap is small, add a space if it's not already there
                    currentCell += (gap > 0.1 ? ' ' : '') + item.str;
                }
            }
        }
        if (currentCell.trim()) {
            row.push(currentCell.trim());
        }

        if (row.some(cell => cell)) {
            rows.push(row);
        }
    });

    return rows;
}


// New simpler parser that respects columns based on spacing.
function parseTextToRows(text: string): RowData[] {
  const rows: RowData[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.trim().length === 0) continue;

    // Split by 2 or more spaces to identify columns
    const columns = line.split(/\s{2,}/).map(col => col.trim());
    if (columns.some(col => col)) {
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
    setExtractedData([]);

    try {
      const typedarray = new Uint8Array(await selectedFile.arrayBuffer());

      setStatus("parsing-text");
      const pdf = await pdfjsLib.getDocument(typedarray).promise;
      
      let allTextItems: TextItem[] = [];
      let pageTexts: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        if (textContent.items.length > 0) {
            allTextItems.push(...textContent.items.map(item => item as TextItem));
        }
        pageTexts.push((await page.getTextContent()).items.map(item => (item as TextItem).str).join(' '));
      }

      // If very little text was extracted, it's likely a scanned/image-based PDF.
      if (allTextItems.filter(item => item.str.trim()).length < 20) {
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
          const viewport = page.getViewport({ scale: 3.0 });
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
          setError("OCR failed to extract readable data. The document might be low quality or unreadable.");
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
    } catch (err: any)
    {
      console.error("Processing Error:", err);
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
        link.download = `${file?.name.replace(/\.pdf$/i, "")}.json`;
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
        `${file?.name.replace(/\.pdf$/i, "")}.${format}`
      );
    },
    [extractedData, file]
  );
  
    const handleOpenInSheets = useCallback(() => {
    if (extractedData.length === 0) return;

    const csvContent = extractedData.map(row => 
        row.map(cell => {
            const newCell = cell || '';
            // Escape quotes by doubling them
            let escapedCell = newCell.replace(/"/g, '""');
            // If cell contains comma, newline, or quote, wrap it in quotes
            if (escapedCell.includes(',') || escapedCell.includes('\n') || escapedCell.includes('"')) {
                escapedCell = `"${escapedCell}"`;
            }
            return escapedCell;
        }).join('\t') // Use tab separator for direct pasting into sheets
    ).join('\n');

    navigator.clipboard.writeText(csvContent).then(() => {
        window.open("https://docs.google.com/spreadsheets/create", "_blank");
        toast({
            title: "Copied & Ready to Paste",
            description: "A new Google Sheet has been opened. Just press Ctrl+V or Cmd+V to paste your data.",
        });
    }, (err) => {
        toast({
            variant: "destructive",
            title: "Copy Failed",
            description: "Could not copy data to clipboard. Please use the CSV or Excel export options.",
        });
        console.error('Failed to copy text: ', err);
    });
}, [extractedData, toast]);


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
            Convert PDF bank statements into structured data — 100% private and free.
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
                    status === "dragging" ? "border-primary bg-accent/50" : "border-border hover:border-primary/50"
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setStatus("dragging");
                  }}
                  onDragEnter={() => setStatus("dragging")}
                  onDragLeave={() => setStatus("idle")}
                  onDrop={(e) => {
                    e.preventDefault();
                    setStatus("idle");
                    if (e.dataTransfer.files?.length) {
                       handleFile(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  <FileUp className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">
                    Drag & drop your PDF here or
                  </p>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                    ref={fileInputRef}
                  />
                  <Button onClick={() => fileInputRef.current?.click()}>
                    Choose File
                  </Button>
                  <p className="text-xs text-muted-foreground mt-4">
                    Up to 20MB. All processing happens securely in your browser.
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
                   <p className="text-sm text-muted-foreground mt-2">Your data is ready to be downloaded or copied.</p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-center">Export Options</h3>
                  <div className="flex flex-wrap justify-center gap-4">
                    <Button onClick={() => handleExport("xlsx")} size="lg">
                      <FileSpreadsheet /> Excel (.xlsx)
                    </Button>
                     <Button onClick={handleOpenInSheets} size="lg" variant="secondary">
                        <Clipboard /> Copy & Open in Sheets
                    </Button>
                    <Button onClick={() => handleExport("csv")} size="lg" variant="outline">
                      <TableIcon /> CSV (.csv)
                    </Button>
                    <Button onClick={() => handleExport("json")} size="lg" variant="outline">
                      <FileJson /> JSON (.json)
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
                                {extractedData.slice(0, 100).map((row, rowIndex) => ( // Preview first 100 rows
                                    <TableRow key={rowIndex}>
                                        {Array.from({ length: maxColumns }).map((_, cellIndex) => (
                                            <TableCell key={cellIndex} className="text-xs whitespace-nowrap">{row[cellIndex] || ''}</TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                         {extractedData.length > 100 && (
                            <p className="text-center text-sm text-muted-foreground py-2">
                                Showing first 100 rows. Full data will be in export.
                            </p>
                        )}
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
