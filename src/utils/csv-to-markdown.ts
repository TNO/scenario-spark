import { KeyDriver } from './morp-box-to-markdown';

/**
 * Detects the delimiter used in pasted spreadsheet text.
 * Checks for tab, semicolon (common in German locale CSV), comma, and pipe.
 */
export function detectDelimiter(text: string): string {
  const nonEmptyLines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (nonEmptyLines.length === 0) return '\t';

  const counts: Record<string, number> = {
    '\t': 0,
    ';': 0,
    ',': 0,
    '|': 0,
  };

  for (const line of nonEmptyLines) {
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (!inQuote) {
        if (ch === '\t') counts['\t']++;
        else if (ch === ';') counts[';']++;
        else if (ch === ',') counts[',']++;
        else if (ch === '|') counts['|']++;
      }
    }
  }

  let best = '\t';
  let bestCount = -1;
  for (const [delim, count] of Object.entries(counts)) {
    if (count > bestCount) {
      bestCount = count;
      best = delim;
    }
  }
  return best;
}

/**
 * Splits a line by the given delimiter, handling quoted fields.
 */
function splitLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        // Check for escaped quote ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === delimiter) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

export type ParsedSpreadsheet = {
  headers: string[];
  rows: string[][];
};

/**
 * Parses raw text from a spreadsheet paste into structured rows.
 * Handles tab-separated, comma-separated, semicolon-separated, and pipe-separated formats.
 */
export function parseSpreadsheetText(text: string): ParsedSpreadsheet {
  if (!text.trim()) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(text);
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = splitLine(lines[0], delimiter);
  const rows: string[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = splitLine(lines[i], delimiter);
    // Pad to match header count
    while (fields.length < headers.length) fields.push('');
    // Trim extra columns beyond headers
    rows.push(fields.slice(0, headers.length));
  }

  // Strip completely empty rows
  return {
    headers,
    rows: rows.filter((r) => r.some((c) => c.length > 0)),
  };
}

/**
 * Converts parsed spreadsheet data to markdown format for morphological boxes.
 *
 * Spreadsheet interpretation:
 * - First row = key driver column headers
 * - Subsequent rows = option values, each cell in a column is an option for that driver
 * - Empty cells are skipped
 */
export function spreadsheetToMarkdown(
  headers: string[],
  rows: string[][],
  categoryLabel?: string
): { markdown: string; warnings: string[] } {
  const warnings: string[] = [];

  if (headers.length < 2) {
    warnings.push(
      headers.length === 1
        ? 'IMPORT_NEEDS_TWO_COLUMNS'
        : 'IMPORT_NO_DRIVERS'
    );
  }

  const keyDrivers: KeyDriver[] = headers.map((header, colIndex) => ({
    id: `col-${colIndex}`,
    label: header,
    values: rows
      .map((row) => row[colIndex])
      .filter((val): val is string => val !== '' && val !== undefined)
      .map((label) => ({
        id: `val-${colIndex}-${label}`,
        label,
      })),
  }));

  // Filter drivers that have no values
  const driversWithValues = keyDrivers.filter((d) => d.values.length > 0);
  if (driversWithValues.length < keyDrivers.length) {
    warnings.push('IMPORT_NO_DRIVERS');
  }

  if (driversWithValues.length === 0) {
    return { markdown: '', warnings: ['IMPORT_NO_DRIVERS'] };
  }

  const catLabel = categoryLabel || driversWithValues[0].label;

  const lines: string[] = [`# ${catLabel}`, ''];
  driversWithValues.forEach((driver, index) => {
    lines.push(`${index + 1}. ${driver.label}`);
    driver.values.forEach((v) => {
      lines.push(`   - ${v.label}`);
    });
    lines.push('');
  });

  return { markdown: lines.join('\n'), warnings };
}

/**
 * Convenience function: raw pasted spreadsheet text -> markdown in one step.
 */
export function csvToMarkdown(
  rawText: string,
  categoryLabel?: string
): { markdown: string; warnings: string[] } {
  const { headers, rows } = parseSpreadsheetText(rawText);

  if (headers.length === 0) {
    return {
      markdown: '',
      warnings: ['IMPORT_NO_DATA'],
    };
  }

  return spreadsheetToMarkdown(headers, rows, categoryLabel);
}
