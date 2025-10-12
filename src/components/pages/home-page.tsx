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

    // Sort items primarily by their vertical position, then horizontal
    items.sort((a, b) => {
        const yA = a.transform[5];
        const yB = b.transform[5];
        const xA = a.transform[4];
        const xB = b.transform[4];

        if (Math.abs(yA - yB) > 2) { // Epsilon for vertical alignment
            return yB - yA; // Higher Y value (lower on page) first
        }
        return xA - xB;
    });

    const lines: { items: TextItem[], y: number }[] = [];
    if (items.length > 0) {
        let currentLine = { items: [items[0]], y: items[0].transform[5] };

        for (let i = 1; i < items.length; i++) {
            const item = items[i];
            
            // If the vertical position is similar, it's the same line
            if (Math.abs(item.transform[5] - currentLine.y) < 5) {
                currentLine.items.push(item);
            } else {
                // New line
                lines.push(currentLine);
                currentLine = { items: [item], y: item.transform[5] };
            }
        }
        lines.push(currentLine); // Push the last line
    }

    const validItems = items.filter(item => item.str.length > 0 && item.width > 0);
    const avgCharWidth = validItems.reduce((acc, item) => acc + (item.width / item.str.length), 0) / (validItems.length || 1);
    const SPACE_THRESHOLD = avgCharWidth * 2.5;

    return lines.map(line => {
        if (line.items.length === 0) return [];
        if (line.items.length === 1) return [line.items[0].str.trim()];
        
        const row: string[] = [];
        let currentCell = line.items[0].str;
        
        for (let i = 1; i < line.items.length; i++) {
            const prev = line.items[i-1];
            const curr = line.items[i];
            const gap = curr.transform[4] - (prev.transform[4] + prev.width);

            if (gap > SPACE_THRESHOLD) {
                row.push(currentCell.trim());
                currentCell = curr.str;
            } else {
                // If gaps are small, items are part of the same cell. 
                // Add a space if they are not directly touching.
                if (gap > 1) {
                   currentCell += " " + curr.str;
                } else {
                   currentCell += curr.str;
                }
            }
        }
        row.push(currentCell.trim());
        return row.filter(cell => cell.length > 0);
    }).filter(row => row.length > 0);
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

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        allTextItems.push(...textContent.items.map(item => item as TextItem));
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
  
    const handleCopyToClipboard = useCallback(() => {
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
        }).join(',')
    ).join('\n');

    navigator.clipboard.writeText(csvContent).then(() => {
        toast({
            title: "Copied to Clipboard",
            description: "You can now paste the data into Google Sheets or any spreadsheet app.",
        });
    }, (err) => {
        toast({
            variant: "destructive",
            title: "Copy Failed",
            description: "Could not copy data to clipboard. Please try again.",
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
                     <Button onClick={handleCopyToClipboard} size="lg" variant="secondary">
                        <Clipboard /> Copy for Sheets
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
