import "dotenv/config";
import { readFile } from "fs/promises";
import { getAllVerifiedSubscribers } from "@/lib/subscribers";

/**
 * Parse a CSV line into fields (handles quoted values with commas).
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let end = i + 1;
      while (end < line.length) {
        const next = line.indexOf('"', end);
        if (next === -1) break;
        if (line[next + 1] === '"') {
          end = next + 2;
          continue;
        }
        end = next;
        break;
      }
      result.push(
        line
          .slice(i + 1, end)
          .replace(/""/g, '"')
          .trim()
      );
      i = end + 1;
      if (line[i] === ",") i++;
      continue;
    }
    const comma = line.indexOf(",", i);
    if (comma === -1) {
      result.push(line.slice(i).trim());
      break;
    }
    result.push(line.slice(i, comma).trim());
    i = comma + 1;
  }
  return result;
}

function getEmailColumnIndex(headerFields: string[]): number {
  const idx = headerFields.findIndex((h) => h.trim().toLowerCase() === "email");
  return idx >= 0 ? idx : 0;
}

function isValidEmail(value: string): boolean {
  return value.length > 0 && value.includes("@") && value.includes(".");
}

async function main(): Promise<void> {
  const csvPath = process.argv[2];

  if (csvPath === undefined || csvPath === "") {
    console.error("Error: CSV path is required as first argument");
    console.error("Usage: pnpm compare:substack <path-to-csv>");
    process.exit(1);
  }

  console.log(`Reading verified subscribers from database...`);
  const verifiedSubscribers = await getAllVerifiedSubscribers();
  const dbEmails = new Set(
    verifiedSubscribers.map((sub) => sub.email.toLowerCase())
  );

  console.log(
    `Found ${String(dbEmails.size)} verified subscribers in database`
  );

  console.log(`Reading ${csvPath}...`);
  const content = await readFile(csvPath, "utf-8");
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    console.error("CSV has no data rows (need at least a header and one row).");
    process.exit(1);
  }

  const header = lines[0];
  if (header === undefined) {
    console.error("CSV has no header line.");
    process.exit(1);
  }
  const headerFields = parseCsvLine(header);
  const emailColIndex = getEmailColumnIndex(headerFields);
  if (
    emailColIndex === 0 &&
    headerFields[0]?.trim().toLowerCase() !== "email"
  ) {
    console.warn(`No "email" column found; using first column as email.`);
  }

  const dataLines = lines.slice(1);
  const csvEmails = new Set<string>();
  let invalid = 0;

  for (const line of dataLines) {
    const fields = parseCsvLine(line);
    const email = (fields[emailColIndex] ?? "").trim();
    if (!isValidEmail(email)) {
      invalid++;
      continue;
    }
    csvEmails.add(email.toLowerCase());
  }

  console.log(
    `Found ${String(csvEmails.size)} valid emails in CSV (${String(invalid)} invalid/skipped)`
  );

  // Find verified subscribers NOT in CSV
  const notInCsv: string[] = [];
  for (const dbEmail of dbEmails) {
    if (!csvEmails.has(dbEmail)) {
      notInCsv.push(dbEmail);
    }
  }

  console.log(
    `\nFound ${String(notInCsv.length)} verified subscribers NOT in ${csvPath}:\n`
  );
  console.log(notInCsv.join(","));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
