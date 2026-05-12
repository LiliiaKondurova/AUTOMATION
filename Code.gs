/*********************
 * CONFIGURATION
 *********************/
const CONFIG = {
  SHEET_ID: "[PASTE_SHEET_ID]",
  SHEET_NAME: "[PASTE_SHEET_TAB_NAME]",
  TEMPLATE_ID: "[PASTE_DOC_TEMPLATE_ID]",
  REVIEW_RECIPIENT: "[PASTE_YOUR_EMAIL]"
};

/*********************
 * MAIN FUNCTION
 *********************/
function generateMonthlyInvoice() {
  console.log("[START] generateMonthlyInvoice");

  const tz = Session.getScriptTimeZone();

  // --- 1. Calculate invoice period (prior month) ---
  const today = new Date();
  const firstDayThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstDayPriorMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastDayPriorMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  const invoiceMonth = firstDayPriorMonth.getMonth(); // 0-indexed
  const invoiceYear = firstDayPriorMonth.getFullYear();

  const invoiceNumber = `${invoiceMonth + 1}/${invoiceYear}`;

  const monthNames = ["January","February","March","April","May","June",
                      "July","August","September","October","November","December"];
  const servicePeriod = `${monthNames[invoiceMonth]} 1\u2013${lastDayPriorMonth.getDate()}, ${invoiceYear}`;
  const issueDate = Utilities.formatDate(today, tz, "MMMM d, yyyy");

  console.log(`[INFO] Invoice period (prior month): ${firstDayPriorMonth.toISOString()} - ${lastDayPriorMonth.toISOString()}`);
  console.log(`[INFO] Invoice number: ${invoiceNumber}`);
  console.log(`[INFO] Service period: ${servicePeriod}`);
  console.log(`[INFO] Issue date: ${issueDate}`);

  // --- 2. Read and filter sheet rows ---
  console.log("[STEP] Reading and filtering sheet rows...");

  let spreadsheet, sheet;
  try {
    spreadsheet = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) throw new Error(`Sheet "${CONFIG.SHEET_NAME}" not found.`);
  } catch (e) {
    console.log(`[ERROR] Failed to read Google Sheet: ${e.message}`);
    throw new Error(`Failed to read Google Sheet: ${e.message}`);
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const col = {
    orderDate:   headers.indexOf("Order_Date"),
    invoiceDate: headers.indexOf("Invoice_Date"),
    project:     headers.indexOf("Project"),
    type:        headers.indexOf("Type"),
    quantity:    headers.indexOf("Quantity"),
    rate:        headers.indexOf("Rate"),
    amount:      headers.indexOf("Amount"),
    status:      headers.indexOf("Status")
  };

  // Validate all columns exist
  for (const [name, index] of Object.entries(col)) {
    if (index === -1) {
      throw new Error(`Column "${name}" not found in sheet. Check column names.`);
    }
  }

  const eligibleRows = data.slice(1).filter(row => {
    const invoiceDateRaw = row[col.invoiceDate];
    if (!invoiceDateRaw) return false;

    const invoiceDate = new Date(invoiceDateRaw);
    const matchesPeriod =
      invoiceDate.getMonth() === invoiceMonth &&
      invoiceDate.getFullYear() === invoiceYear;

    const status = String(row[col.status]).trim();

    return matchesPeriod && status === "Done";
  });

  console.log(`[INFO] Eligible rows: ${eligibleRows.length}`);

  if (eligibleRows.length === 0) {
    console.log("[INFO] No eligible rows found for the invoice period. Stopping.");
    return;
  }

  // --- 3. Aggregate data ---
  let qTransl = 0, qProofr = 0;
  let amountTransl = 0, amountProofr = 0;

  for (const row of eligibleRows) {
    const type = String(row[col.type]).trim();
    const quantity = Number(row[col.quantity]) || 0;
    const amount = Number(row[col.amount]) || 0;

    if (type === "T") {
      qTransl += quantity;
      amountTransl += amount;
    } else if (type === "P") {
      qProofr += quantity;
      amountProofr += amount;
    }
  }

  // Round only for display
  const amountTotal = amountTransl + amountProofr;
  const priceTransl = qTransl > 0 ? amountTransl / qTransl : 0;
  const priceProofr = qProofr > 0 ? amountProofr / qProofr : 0;

  const fmt = (n, decimals = 2) => n.toFixed(decimals);

  // --- 4. Copy template ---
  console.log("[STEP] Copying Google Docs template...");

  let tempDoc;
  try {
    const templateFile = DriveApp.getFileById(CONFIG.TEMPLATE_ID);
    const tempFile = templateFile.makeCopy(`Invoice ${invoiceNumber} (temp)`);
    tempDoc = DocumentApp.openById(tempFile.getId());
  } catch (e) {
    console.log(`[ERROR] Failed to copy template: ${e.message}`);
    throw new Error(`Failed to copy template: ${e.message}`);
  }

  // --- 5. Replace placeholders ---
  console.log("[STEP] Replacing placeholders...");

  const body = tempDoc.getBody();

  const replacements = {
    "{{INVOICE_NUMBER}}":  invoiceNumber,
    "{{SERVICE_PERIOD}}":  servicePeriod,
    "{{ISSUE_DATE}}":      issueDate,
    "{{Q_TRANSL}}":        Math.round(qTransl).toString(),
    "{{Q_PROOFR}}":        Math.round(qProofr).toString(),
    "{{PRICE_TRANSL}}":    fmt(priceTransl),
    "{{PRICE_PROOFR}}":    fmt(priceProofr),
    "{{AMOUNT_TRANSL}}":   fmt(amountTransl),
    "{{AMOUNT_PROOFR}}":   fmt(amountProofr),
    "{{AMOUNT_TOTAL}}":    fmt(amountTotal)
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    body.replaceText(placeholder, value);
  }

  tempDoc.saveAndClose();
  console.log("[INFO] Placeholders replaced successfully.");

  // --- 6. Export PDF ---
  console.log("[STEP] Exporting PDF...");

  let pdfBlob;
  try {
    const tempFile = DriveApp.getFileById(tempDoc.getId());
    pdfBlob = tempFile.getAs("application/pdf");
    pdfBlob.setName(`Invoice ${invoiceNumber}.pdf`);
  } catch (e) {
    console.log(`[ERROR] Failed to export PDF: ${e.message}`);
    throw new Error(`Failed to export PDF: ${e.message}`);
  }

  console.log("[INFO] PDF exported successfully.");

  // --- 7. Send email ---
  console.log("[STEP] Sending email...");

  try {
    MailApp.sendEmail({
      to: CONFIG.REVIEW_RECIPIENT,
      subject: `Invoice ${invoiceNumber}`,
      body:
`Hello,

Please find attached invoice ${invoiceNumber}.

If you have any questions or need additional details, I'll be happy to help.

Thank you,
Best Regards,
John Doe`,
      attachments: [pdfBlob]
    });
  } catch (e) {
    console.log(`[ERROR] Failed to send email: ${e.message}`);
    throw new Error(`Failed to send email: ${e.message}`);
  }

  console.log(`[INFO] Email sent to ${CONFIG.REVIEW_RECIPIENT}.`);

  // --- 8. Cleanup: trash temporary doc ---
  console.log("[STEP] Cleaning up temporary doc...");

  try {
    DriveApp.getFileById(tempDoc.getId()).setTrashed(true);
  } catch (e) {
    console.log(`[WARN] Failed to trash temporary doc: ${e.message}`);
    // Non-critical: don't throw, just warn
  }

  console.log("[INFO] Temporary doc moved to trash.");
  console.log(`[DONE] Invoice ${invoiceNumber} generated and sent successfully.`);
}
