import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">About This Tool</CardTitle>
          <CardDescription>Our mission, technology, and commitment to your privacy.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-foreground/90">
          <section>
            <h2 className="text-2xl font-semibold mb-2">Our Goal</h2>
            <p>
              We created the Bank Statement Converter with a simple but powerful goal: to provide a completely free, private, and easy-to-use tool for converting PDF bank statements into structured data formats like Excel (XLSX) and CSV. We believe that managing your financial data should be straightforward and secure, without compromising your privacy.
            </p>
          </section>
          <section>
            <h2 className="text-2xl font-semibold mb-2">Core Philosophy</h2>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>100% Privacy First:</strong> Your data never leaves your computer. All processing happens directly in your browser. We do not upload your files, and we do not see your data.</li>
              <li><strong>Free Forever:</strong> This tool is free to use, with no sign-ups, no payments, and no usage limits.</li>
              <li><strong>Simplicity:</strong> A clean, intuitive interface is at the heart of our design. Just drag, drop, and download.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-2xl font-semibold mb-2">The Technology Behind It</h2>
            <p>
              To make this possible, we use a stack of modern, browser-based technologies:
            </p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li><strong>Next.js & React:</strong> Powers our fast and responsive user interface.</li>
              <li><strong>pdf.js:</strong> A library from Mozilla that allows us to extract text directly from digital PDFs in the browser.</li>
              <li><strong>Tesseract.js:</strong> For scanned (image-based) PDFs, this powerful Optical Character Recognition (OCR) engine reads the text from images.</li>
              <li><strong>Client-Side Parsing:</strong> We use regular expressions within the browser to identify and extract transaction data, ensuring nothing is sent to a server.</li>
              <li><strong>SheetJS (xlsx):</strong> This library enables the instant creation of Excel and CSV files right from your browser.</li>
            </ul>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
