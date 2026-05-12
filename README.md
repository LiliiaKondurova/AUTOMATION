# PROMPT: GENERATE GOOGLE APPS SCRIPT FOR INVOICE AUTOMATION
You are an experienced Google Apps Script developer.
Goal:
Create a Google Apps Script that generates a monthly invoice PDF from
Google Sheets data using a Google Docs template with placeholders.
The script must email the PDF to REVIEW_RECIPIENT, then move the
temporary filled Google Doc to trash.
Environment:
- Google Apps Script (V8 runtime), no external libraries
- Data source: Google Sheets
- Template: Google Docs
- Output: PDF file
- Email: send to REVIEW_RECIPIENT only
Configuration:
const CONFIG = {
  SHEET_ID:         "[PASTE_SHEET_ID]",
  SHEET_NAME:       "[PASTE_SHEET_TAB_NAME]",
  TEMPLATE_ID:      "[PASTE_DOC_TEMPLATE_ID]",
  REVIEW_RECIPIENT: "[PASTE_YOUR_EMAIL]"
};
Google Sheet structure (one row = one order):
- Order_Date    (date)
- Invoice_Date  (date; first day of the invoicing month)
- Project       (text)
- Type          (dropdown: "T" = Translation, "P" = Proofreading)
- Quantity      (number; minutes for T, words for P)
- Rate          (number; per minute for T, per word for P)
- Amount        (number; Quantity × Rate)
- Status        (dropdown: "In progress" / "Done" / "Invoiced")
Filtering rules:
- Include only rows where Invoice_Date matches the invoice period
- Include only rows where Status = "Done"
- Exclude rows where Status = "Invoiced"
- If zero eligible rows → stop, log a message, no PDF, no email
Invoice period:
Always invoice the PRIOR month.
(Example: if today is May 11, period = April 1–30.)
Timezone:
Use Session.getScriptTimeZone() for all date formatting
and date calculations.
Placeholder replacement rules:
{{INVOICE_NUMBER}}  = month/year of invoiced period (e.g. 4/2026)
{{SERVICE_PERIOD}}  = full range (e.g. April 1–30, 2026)
{{ISSUE_DATE}}      = today (e.g. May 11, 2026)
{{Q_TRANSL}}        = sum(Quantity) where Type=T and Status=Done
{{Q_PROOFR}}        = sum(Quantity) where Type=P and Status=Done
{{AMOUNT_TRANSL}}   = sum(Amount)   where Type=T and Status=Done
{{AMOUNT_PROOFR}}   = sum(Amount)   where Type=P and Status=Done
{{PRICE_TRANSL}}    = AMOUNT_TRANSL / Q_TRANSL (0 if Q_TRANSL=0)
{{PRICE_PROOFR}}    = AMOUNT_PROOFR / Q_PROOFR (0 if Q_PROOFR=0)
{{AMOUNT_TOTAL}}    = AMOUNT_TRANSL + AMOUNT_PROOFR
Number formatting:
- All amounts: 2 decimal places (e.g. 75.00)
- Quantities: whole numbers
- No currency symbol in the document
- Round only for display — sum raw values first, then round
PDF and email:
- PDF name:      "Invoice [INVOICE_NUMBER]"
- Email subject: "Invoice [INVOICE_NUMBER]"
- Email body:
  "Hello,
  Please find attached invoice [INVOICE_NUMBER].
  If you have any questions, I'll be happy to help.
  Thank you, Best Regards, John Doe"
Error handling:
If any critical step fails (reading sheet, copying template,
sending email), log a clear error and throw an informative
exception instead of failing silently.
Logging:
Add console.log() at each main step:
Script start → Rows read → Template copied →
Placeholders replaced → PDF exported → Email sent → Cleanup done
Return:
Full Apps Script code in one piece, ready to paste into Code.gs.
