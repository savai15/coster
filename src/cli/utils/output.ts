export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function printSuccess(message: string): void {
  console.log(message);
}

export function printInfo(message: string): void {
  console.log(message);
}

export function printError(message: string): void {
  console.error(message);
}

export function printTable(headers: string[], rows: (string | number)[][]): void {
  const widths = headers.map((h, i) => {
    const cellMax = rows.reduce((max, r) => Math.max(max, String(r[i] ?? '').length), 0);
    return Math.max(h.length, cellMax);
  });

  const fmt = (cells: (string | number)[]) =>
    cells.map((c, i) => String(c ?? '').padEnd(widths[i])).join('  ');

  console.log(fmt(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of rows) {
    console.log(fmt(row));
  }
}
