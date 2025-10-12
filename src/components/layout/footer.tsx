import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-card">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center gap-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 w-full">
                <p className="text-sm text-muted-foreground text-center md:text-left">
                    &copy; {currentYear} Bank Statement Converter. All rights reserved.
                </p>
                <div className="flex items-center gap-4 text-sm">
                    <Link href="/about" className="text-muted-foreground hover:text-foreground">About</Link>
                    <Link href="/faq" className="text-muted-foreground hover:text-foreground">FAQ</Link>
                    <Link href="/privacy" className="text-muted-foreground hover:text-foreground">Privacy</Link>
                    <Link href="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link>
                </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
                Developed by <a href="https://aliubaid.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">Ali Ubaid</a>.
            </p>
        </div>
      </div>
    </footer>
  );
}
