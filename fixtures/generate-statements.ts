import { writeFileSync } from 'node:fs';
import { createTextPdf, SAMPLE_STATEMENT_LINES } from '../src/features/import/sample';

const write = (name: string, lines: readonly string[]) => writeFileSync(new URL(name, import.meta.url), createTextPdf(lines));
write('campus-demo-statement.pdf', SAMPLE_STATEMENT_LINES);
write('changed-amount.pdf', SAMPLE_STATEMENT_LINES.map(line => line.replace('24.50', '25.50')));
const damaged = [...SAMPLE_STATEMENT_LINES];
damaged.splice(8, 0, '10/10/2026 | CAFE | unreadable |');
write('unreadable-row.pdf', damaged);
write('unsupported-layout.pdf', ['Fictional other-bank statement', 'This layout is intentionally unsupported.']);
write('no-text.pdf', []);
console.log('Wrote five synthetic PDF fixtures. No real financial data is included.');
