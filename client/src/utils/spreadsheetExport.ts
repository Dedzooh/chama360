type Cell = unknown;

export type CsvSheet = {
  __rows: Cell[][];
  [key: string]: unknown;
};

export type CsvWorkbook = {
  Props?: Record<string, unknown>;
  SheetNames: string[];
  Sheets: Record<string, CsvSheet>;
};

const csvCell = (value: Cell) => {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  // Prevent values controlled by users from becoming spreadsheet formulas.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

const book_new = (): CsvWorkbook => ({ SheetNames: [], Sheets: {} });

const aoa_to_sheet = (rows: Cell[][]): CsvSheet => ({ __rows: rows });

const encode_col = (column: number) => {
  let result = '';
  for (let value = column + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  }
  return result;
};

const book_append_sheet = (workbook: CsvWorkbook, sheet: CsvSheet, name: string) => {
  workbook.SheetNames.push(name);
  workbook.Sheets[name] = sheet;
};

const writeFile = (workbook: CsvWorkbook, filename: string) => {
  const rows = workbook.SheetNames.flatMap((name, index) => [
    ...(index > 0 ? [[]] : []),
    [`${name.toUpperCase()} SECTION`],
    ...(workbook.Sheets[name]?.__rows ?? []),
  ]);
  const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const utils = { book_new, aoa_to_sheet, encode_col, book_append_sheet };
export { writeFile };
