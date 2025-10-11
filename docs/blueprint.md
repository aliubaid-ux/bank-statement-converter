# **App Name**: Bank Statement Converter

## Core Features:

- PDF Upload and Handling: Allows users to upload PDF bank statements via drag-and-drop or file selection. Supports multi-page PDFs up to 20 MB.
- PDF Text Extraction: Extracts text and table structures from digital PDFs using pdf.js. Utilizes Tesseract.js (WebAssembly-based OCR) for scanned image PDFs with a progress indicator.
- Parsing and Data Processing: Automatically detects table layouts typical for bank statements, normalizes date and numeric formats, handles negative/positive amounts, merges multi-line descriptions, and cleans irrelevant text using AI tool for table detection and key information recognition.
- Output Generation: Exports data to CSV, Excel (XLSX), and optionally JSON formats using SheetJS. Provides an instant in-browser download and a preview table (first 20 rows) before export.
- User Interface: Features a simple home page layout with an upload section, conversion progress indicator, output preview section, and export buttons. Uses React (Next.js frontend), TailwindCSS + Shadcn UI for styling, and Framer Motion for animations.
- Privacy and Security: Ensures all processing is done in the user's browser with no backend calls, cookies, or analytics tracking. Provides a clear "Privacy First" section explaining data handling.
- Performance and Optimization: Lazy-loads heavy libraries (Tesseract.js, pdf.js), uses Web Workers for background parsing, displays a progress bar for OCR jobs, manages memory efficiently, and limits file size to avoid memory exhaustion.

## Style Guidelines:

- Primary color: Muted blue (#6699CC), conveying trust and stability, inspired by the serious nature of banking but without being austere.
- Background color: Light gray (#F0F4F7), providing a clean and neutral backdrop.
- Accent color: Soft teal (#70A4BC), used for interactive elements and highlights, offering a touch of modernity and distinctiveness.
- Body and headline font: 'Inter' sans-serif for a modern, machined, objective, neutral look.
- Simple, clear icons for file types and actions.
- Clean, minimal layout with rounded containers and soft shadows for a modern look.
- Subtle animations for upload and conversion progress using Framer Motion.