import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import Link from "next/link";

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Card className="max-w-3xl mx-auto text-center">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Get In Touch</CardTitle>
          <CardDescription>We'd love to hear your feedback or answer any questions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            For support, suggestions, or any other inquiries, please feel free to send us an email.
          </p>
          <Button asChild size="lg">
            <Link href="mailto:contact@bankstatementconverter.com">
              <Mail className="mr-2 h-5 w-5" /> Email Us
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground pt-4">
            We'll do our best to get back to you as soon as possible.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
