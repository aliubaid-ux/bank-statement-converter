import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function FaqPage() {
  const faqs = [
    {
      question: "Is this service really free?",
      answer: "Yes, completely free. There are no hidden costs, no premium features, and no usage limits. Our goal is to provide a useful utility for everyone."
    },
    {
      question: "How is my privacy protected?",
      answer: "Your privacy is our top priority. The entire conversion process happens inside your web browser. Your files are never uploaded to our servers or any third-party service. We cannot see, store, or access your data in any way."
    },
    {
      question: "What happens to my file after conversion?",
      answer: "Your file is processed in your browser's memory. Once you close the tab or refresh the page, the data is gone. Nothing is saved."
    },
    {
      question: "What file formats do you support for conversion?",
      answer: "We currently support converting PDF bank statements. This includes both digitally generated PDFs and scanned (image-based) PDFs, thanks to our built-in OCR technology."
    },
    {
      question: "Why did my conversion fail or produce incorrect data?",
      answer: "Bank statements come in thousands of different layouts. While our AI parser is very powerful, some complex or unusual formats might not be recognized perfectly. For best results, use clear, high-quality digital PDFs. If you encounter an issue, please ensure the document is a standard bank statement."
    },
    {
      question: "Is there a file size limit?",
      answer: "Yes, we recommend a file size limit of 20MB. This is to ensure the tool runs smoothly within your browser's memory limits, especially for scanned documents that require intensive OCR processing."
    }
  ];

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Frequently Asked Questions</CardTitle>
          <CardDescription>Find answers to common questions about our tool.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem value={`item-${index}`} key={index}>
                <AccordionTrigger className="text-left font-semibold">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-foreground/80">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
