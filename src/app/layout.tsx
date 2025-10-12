import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  title: 'Free & Private Bank Statement Converter | PDF to Excel/CSV',
  description: 'Instantly convert PDF bank statements to Excel (XLSX) or CSV. 100% free, private, and secure. All processing happens in your browser—no uploads required. Uses OCR for scanned documents.',
  keywords: ['pdf to excel', 'pdf to csv', 'bank statement converter', 'bank statement parser', 'pdf converter', 'free tool', 'secure', 'private', 'ocr', 'financial data extraction'],
  applicationName: 'Bank Statement Converter',
  authors: [{ name: 'Bank Statement Converter' }],
  creator: 'Bank Statement Converter',
  publisher: 'Bank Statement Converter',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "Bank Statement Converter",
        "description": "A free, private tool to convert PDF bank statements into structured data formats like Excel (XLSX) and CSV. All processing is done locally in the browser.",
        "applicationCategory": "FinancialApplication",
        "operatingSystem": "All",
        "browserRequirements": "Requires a modern browser with JavaScript enabled.",
        "offers": {
          "@type": "Offer",
          "price": "0"
        },
        "mainEntity": {
          "@type": "WebPage",
          "@id": "https://bankstatementconverter.com"
        }
      };

  return (
    <html lang="en" className="h-full">
      <head>
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased flex flex-col h-full" suppressHydrationWarning>
        <Header />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
