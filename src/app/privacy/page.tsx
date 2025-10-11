import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Card className="max-w-3xl mx-auto">
        <CardHeader className="text-center">
            <ShieldCheck className="h-12 w-12 mx-auto text-primary" />
          <CardTitle className="text-3xl font-bold mt-4">Privacy Policy</CardTitle>
          <CardDescription>Your privacy is not just a policy; it's the foundation of this tool.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-foreground/90">
          <section>
            <h2 className="text-2xl font-semibold mb-2">The Guiding Principle: No Data Leaves Your Device</h2>
            <p>
              This tool was built with a "privacy-first" architecture. We designed it so that your sensitive financial documents and the data within them are never transmitted over the internet.
            </p>
          </section>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-4 bg-background rounded-lg border">
                <h3 className="font-semibold text-lg mb-2">What We DO NOT Do:</h3>
                <ul className="list-disc list-inside space-y-2 text-sm">
                    <li>We DO NOT upload your PDF files to any server.</li>
                    <li>We DO NOT use any external AI or third-party data processing services.</li>
                    <li>We DO NOT store your data, even temporarily.</li>
                    <li>We DO NOT use third-party analytics that track your activity.</li>
                    <li>We DO NOT use cookies for tracking or identification.</li>
                    <li>We DO NOT require you to create an account or sign in.</li>
                </ul>
            </div>
             <div className="p-4 bg-background rounded-lg border">
                <h3 className="font-semibold text-lg mb-2">What We DO:</h3>
                <ul className="list-disc list-inside space-y-2 text-sm">
                    <li>All file reading and data processing happens locally in your browser.</li>
                    <li>We use in-browser technologies like Javascript, pdf.js, and Tesseract.js.</li>
                    <li>The extracted text is parsed locally by your browser.</li>
                    <li>All data is cleared from your browser's memory when you close the page.</li>
                </ul>
            </div>
          </div>
          
          <section>
            <h2 className="text-2xl font-semibold mb-2">How It Works</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>You select or drop a PDF file onto the page.</li>
              <li>Your browser's Javascript reads the file into its local memory.</li>
              <li>The text is extracted or OCR'd, still within your browser.</li>
              <li>Your browser parses the text to find transactions.</li>
              <li>You download the converted file directly to your computer.</li>
            </ol>
            <p className="mt-4 font-medium">At no point in this process is your file or its content sent to a server.</p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
