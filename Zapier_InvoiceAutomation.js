// ============================================================
// ZAPIER — Code by Zapier (JavaScript)
// Invoice Metrics Processor (FINAL)
// ============================================================

console.log("=== Invoice Processor: START ===");

// ------------------------------------------------------------
// 1. HELPERS
// ------------------------------------------------------------

// Normalize Zapier input (array or comma-separated string)
function toArray(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim());
  if (typeof value === "string") return value.split(",").map(v => v.trim());
  if (value === undefined || value === null) return [];
  return [String(value).trim()];
}

// Detect broken format: "YYYY,MM/DD/"
function isBrokenSingleDateString(s) {
  if (typeof s !== "string") return false;
  return /^\d{4},\d{1,2}\/\d{1,2}\/?$/.test(s.trim());
}

// Parse ANY date format
function parseAnyDate(value) {
  if (value === null || value === undefined || value === "") {
    return new Date("invalid");
  }

  // Excel / Google Sheets serial number
  if (!isNaN(value)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(epoch.getTime() + Number(value) * 86400000);
  }

  if (typeof value !== "string") return new Date("invalid");

  const s = value.trim();

  // Broken format
  if (isBrokenSingleDateString(s)) {
    const [yearStr, mdStr] = s.split(",");
    const [m, d] = mdStr.split("/").filter(Boolean);
    return new Date(Number(yearStr), Number(m) - 1, Number(d));
  }

  // M/D/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    return new Date(Number(mdy[3]), Number(mdy[1]) - 1, Number(mdy[2]));
  }

  // ISO YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  return new Date(s);
}

// Remove time for safe comparisons
function stripTime(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Safe number conversion
function toNumber(v) {
  const n = Number(String(v).replace(/,/g, "").trim());
  return isFinite(n) ? n : 0;
}

// Format number
function fmt2(n) {
  return n.toFixed(2);
}

// ------------------------------------------------------------
// 2. INPUT DATA
// ------------------------------------------------------------

const quantities = toArray(inputData.Quantity);
const amounts = toArray(inputData.Amount);
const dates = toArray(inputData.Date);
const statuses = toArray(inputData.Status);
const types = toArray(inputData.Type);

const rowCount_total = Math.max(
  quantities.length,
  amounts.length,
  dates.length,
  statuses.length,
  types.length
);

console.log("Rows received:", rowCount_total);

// ------------------------------------------------------------
// 3. PERIOD (PRIOR MONTH)
// ------------------------------------------------------------

const today = new Date();
const lastDayPrior = new Date(today.getFullYear(), today.getMonth(), 0);
const firstDayPrior = new Date(lastDayPrior.getFullYear(), lastDayPrior.getMonth(), 1);

// ------------------------------------------------------------
// 4. BUILD ROW OBJECTS
// ------------------------------------------------------------

const rows = [];

for (let i = 0; i < rowCount_total; i++) {

  const dateRaw = parseAnyDate(dates[i]);
  const date = isNaN(dateRaw) ? null : stripTime(dateRaw);

  const row = {
    index: i + 1,
    qty: toNumber(quantities[i]),
    amount: toNumber(amounts[i]),
    date,
    status: (statuses[i] || "").trim(),
    type: (types[i] || "").trim().toUpperCase()
  };

  console.log("Row parsed:", row);

  // Skip empty
  if (!row.qty && !row.amount && !row.date && !row.status) continue;

  // Only T / P
  if (row.type !== "T" && row.type !== "P") continue;

  rows.push(row);
}

console.log("Valid rows:", rows.length);

// ------------------------------------------------------------
// 5. FILTER
// ------------------------------------------------------------

function inPeriod(d) {
  if (!(d instanceof Date) || isNaN(d)) return false;

  const clean = stripTime(d);
  return clean >= stripTime(firstDayPrior) && clean <= stripTime(lastDayPrior);
}

const filtered = rows.filter(r => {
  if (r.status === "Invoiced") return false;
  if (r.status !== "Done") return false;
  if (!r.date || !inPeriod(r.date)) return false;
  return true;
});

console.log("Filtered rows:", filtered.length);

// ------------------------------------------------------------
// 6. DATE OUTPUTS
// ------------------------------------------------------------

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const INVOICE_NUMBER = `${firstDayPrior.getMonth() + 1}-${firstDayPrior.getFullYear()}`;
const SERVICE_PERIOD = `${MONTHS[firstDayPrior.getMonth()]} 1–${lastDayPrior.getDate()}, ${firstDayPrior.getFullYear()}`;
const ISSUE_DATE = `${MONTHS[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

// ------------------------------------------------------------
// 7. NO DATA CASE
// ------------------------------------------------------------

if (filtered.length === 0) {
  console.warn("No data for invoice period");

  return {
    hasData: false,
    INVOICE_NUMBER,
    SERVICE_PERIOD,
    ISSUE_DATE,
    Q_TRANSL: 0,
    Q_PROOFR: 0,
    AMOUNT_TRANSL: "0.00",
    AMOUNT_PROOFR: "0.00",
    PRICE_TRANSL: "0.00",
    PRICE_PROOFR: "0.00",
    AMOUNT_TOTAL: "0.00",
    rowCount_total,
    rowCount_filtered: 0
  };
}

// ------------------------------------------------------------
// 8. CALCULATIONS
// ------------------------------------------------------------

let qT = 0, qP = 0;
let aT = 0, aP = 0;

for (const r of filtered) {
  if (r.type === "T") {
    qT += r.qty;
    aT += r.amount;
  } else {
    qP += r.qty;
    aP += r.amount;
  }
}

const total = aT + aP;

const pT = qT > 0 ? aT / qT : 0;
const pP = qP > 0 ? aP / qP : 0;

// ------------------------------------------------------------
// 9. OUTPUT
// ------------------------------------------------------------

const result = {
  hasData: true,

  INVOICE_NUMBER,
  SERVICE_PERIOD,
  ISSUE_DATE,

  Q_TRANSL: Math.round(qT),
  Q_PROOFR: Math.round(qP),

  AMOUNT_TRANSL: fmt2(aT),
  AMOUNT_PROOFR: fmt2(aP),
  PRICE_TRANSL: fmt2(pT),
  PRICE_PROOFR: fmt2(pP),
  AMOUNT_TOTAL: fmt2(total),

  rowCount_total,
  rowCount_filtered: filtered.length
};

console.log("=== DONE ===");
console.log(result);

return result;