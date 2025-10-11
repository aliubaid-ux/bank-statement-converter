'use server';

/**
 * @fileOverview Parses bank statement data to detect table layouts, normalize data, and clean irrelevant text.
 *
 * - parseBankStatementData - A function that handles the bank statement parsing process.
 * - ParseBankStatementDataInput - The input type for the parseBankStatementData function.
 * - ParseBankStatementDataOutput - The return type for the parseBankStatementData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ParseBankStatementDataInputSchema = z.object({
  text: z
    .string()
    .describe('The text extracted from the bank statement PDF.'),
});
export type ParseBankStatementDataInput = z.infer<typeof ParseBankStatementDataInputSchema>;

const ParseBankStatementDataOutputSchema = z.object({
  transactions: z.array(
    z.object({
      date: z.string().describe('The date of the transaction in YYYY-MM-DD format.'),
      description: z.string().describe('The description of the transaction.'),
      debit: z.number().optional().describe('The debit amount of the transaction.'),
      credit: z.number().optional().describe('The credit amount of the transaction.'),
      balance: z.number().optional().describe('The balance after the transaction.'),
    })
  ).describe('An array of transactions extracted from the bank statement.'),
});
export type ParseBankStatementDataOutput = z.infer<typeof ParseBankStatementDataOutputSchema>;

export async function parseBankStatementData(input: ParseBankStatementDataInput): Promise<ParseBankStatementDataOutput> {
  return parseBankStatementDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'parseBankStatementDataPrompt',
  input: {schema: ParseBankStatementDataInputSchema},
  output: {schema: ParseBankStatementDataOutputSchema},
  prompt: `You are an expert financial data extraction specialist.

  Your task is to parse the provided bank statement text and extract transaction data.
  The bank statement text will be provided within triple curly braces.

  Here are the guidelines for parsing:
  - Automatically detect table layouts typical for bank statements.
  - Normalize date formats to YYYY-MM-DD.
  - Handle numeric values, including commas and dots.
  - Correctly identify debit and credit amounts (including "CR" or "DR" indicators).
  - Merge multi-line transaction descriptions.
  - Clean footers, totals, and irrelevant text.

  Output the data as a JSON array of transactions.  Each transaction object should include the following fields:
  - date (YYYY-MM-DD)
  - description
  - debit (if applicable)
  - credit (if applicable)
  - balance (if available)

  Ensure that the output is a valid JSON format that can be parsed without errors.

  Bank Statement Text: {{{text}}}
  `,
});

const parseBankStatementDataFlow = ai.defineFlow(
  {
    name: 'parseBankStatementDataFlow',
    inputSchema: ParseBankStatementDataInputSchema,
    outputSchema: ParseBankStatementDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
