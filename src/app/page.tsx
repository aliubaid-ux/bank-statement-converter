import { HomePage } from '@/components/pages/home-page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Lock, Zap } from 'lucide-react';

export default function Home() {
  return (
    <>
      <HomePage />
      <div className="py-16 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold tracking-tight">Your Data, Your Control</h2>
                <p className="mt-2 text-lg text-muted-foreground">Privacy isn't an afterthought; it's our foundation.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary text-primary-foreground mb-4">
                        <Lock className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-semibold">100% Private</h3>
                    <p className="mt-2 text-muted-foreground">
                        Your files are never uploaded. All conversion happens securely in your browser. We never see your data.
                    </p>
                </div>
                <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary text-primary-foreground mb-4">
                        <Zap className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-semibold">Instant Conversion</h3>
                    <p className="mt-2 text-muted-foreground">
                        No queues, no waiting. Get your structured data in seconds, supporting both digital and scanned PDFs.
                    </p>
                </div>
                <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary text-primary-foreground mb-4">
                        <CheckCircle className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-semibold">Completely Free</h3>
                    <p className="mt-2 text-muted-foreground">
                        This tool is free, forever. No subscriptions, no hidden fees, and no usage limits.
                    </p>
                </div>
            </div>
        </div>
      </div>
       <div className="py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold">How It Works</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                A simple three-step process to reclaim your financial data.
              </p>
              <ul className="mt-6 space-y-4">
                <li className="flex items-start">
                  <CheckCircle className="h-6 w-6 text-green-500 mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold">1. Upload Your PDF</h4>
                    <p className="text-muted-foreground">Drag and drop or select your bank statement PDF. The file stays on your computer.</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-6 w-6 text-green-500 mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold">2. Automated Processing</h4>
                    <p className="text-muted-foreground">Our in-browser engine reads the file, identifies the transaction table, and extracts the data—all in seconds.</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-6 w-6 text-green-500 mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold">3. Download or Copy</h4>
                    <p className="text-muted-foreground">Export your data as an Excel, CSV, or JSON file, or copy it directly into Google Sheets.</p>
                  </div>
                </li>
              </ul>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Powerful Features</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-4 text-muted-foreground">
                        <li className="flex items-center"><CheckCircle className="h-4 w-4 text-primary mr-2" /> Supports both digital & scanned PDFs</li>
                        <li className="flex items-center"><CheckCircle className="h-4 w-4 text-primary mr-2" /> Built-in OCR for image-based statements</li>
                        <li className="flex items-center"><CheckCircle className="h-4 w-4 text-primary mr-2" /> Smart table detection logic</li>
                        <li className="flex items-center"><CheckCircle className="h-4 w-4 text-primary mr-2" /> Export to XLSX, CSV, and JSON</li>
                        <li className="flex items-center"><CheckCircle className="h-4 w-4 text-primary mr-2" /> Direct copy for Google Sheets</li>
                        <li className="flex items-center"><CheckCircle className="h-4 w-4 text-primary mr-2" /> No file uploads, 100% client-side</li>
                    </ul>
                </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
