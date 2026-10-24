import { useEffect, useId, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useAppState } from '../../../useAppState';
import { getImportLedger, ledgerReplacement } from './frontendAdapter';
import { confirmImport, possibleDuplicateIds, summariseTransactions } from './ledger';
import { parseStatement } from './pdf';
import { createSampleStatement } from './sample';
import { CATEGORY_LABELS, KIND_LABELS } from './types';
import type { ImportPreview, LedgerState, Transaction, UnresolvedRow } from './types';
import { ReviewTransactionForm } from './ReviewTransactionForm';
import './pdf-upload.css';

const money = (pence: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
const dateLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function downloadSample() {
  const url = URL.createObjectURL(createSampleStatement());
  const link = document.createElement('a');
  link.href = url; link.download = 'morrow-sample-statement.pdf'; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function StatementReview({ preview, ledger, onCommit, onCancel }: {
  preview: ImportPreview; ledger: LedgerState; onCommit: (ledger: LedgerState) => void; onCancel: () => void;
}) {
  const [rows, setRows] = useState(preview.transactions);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [error, setError] = useState('');
  const editor = useRef<HTMLDivElement>(null);
  const summary = summariseTransactions(rows);
  const duplicateIds = possibleDuplicateIds(rows, ledger.transactions);
  const remainingDuplicates = duplicateIds.filter(id => !acknowledged.includes(id)).length;
  const unreadable = preview.unresolvedRows.filter(row => !rows.some(transaction => transaction.id === row.id));
  const pending = unreadable.filter(row => !excluded.includes(row.id)).length;
  useEffect(() => { if (editing) editor.current?.querySelector('input')?.focus(); }, [editing]);

  function repair(row: UnresolvedRow) {
    setEditing({ id: row.id, date: preview.coverageStart, description: '', amountPence: 0, currency: 'GBP',
      kind: 'expense', category: 'other', source: 'statement', importId: preview.id, sourceRow: row.sourceRow });
  }

  function save(updated: Transaction) {
    setRows(current => current.some(row => row.id === updated.id) ? current.map(row => row.id === updated.id ? updated : row) : [...current, updated]);
    setExcluded(current => current.filter(id => id !== updated.id));
    setAcknowledged(current => current.filter(id => id !== updated.id));
    setEditing(null); setError('');
  }

  function commit() {
    try { onCommit(confirmImport(ledger, preview, { transactions: rows, excludedRowIds: excluded, acknowledgedDuplicateIds: acknowledged })); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Check the review and try again.'); }
  }

  return <div className="pdf-review">
    <div className="summary-grid pdf-summary" aria-label="Statement totals">
      <article className="summary-card summary-primary"><div className="summary-label">SPENDING AFTER REFUNDS<span className="summary-period">THIS STATEMENT</span></div><strong>{money(summary.netSpendingPence)}</strong><div className="summary-foot"><span>Purchases less refunds</span><span>Transfers excluded</span></div></article>
      <article className="summary-card"><div className="summary-label">INCOME<span className="summary-symbol">↗</span></div><strong>{money(summary.incomePence)}</strong><div className="summary-foot"><span>Wages and other income</span></div></article>
      <article className="summary-card"><div className="summary-label">STUDENT FUNDING<span className="summary-symbol">◎</span></div><strong>{money(summary.fundingPence)}</strong><div className="summary-foot"><span>Shown separately from income</span></div></article>
    </div>
    <section className="surface pdf-review-card" aria-labelledby="pdf-review-title">
      <div className="section-heading"><div><p className="eyebrow">CHECK THE DETAILS</p><h2 id="pdf-review-title">A quick review, then you’re ready.</h2></div><span className="pdf-badge">Ready to review</span></div>
      <p className="pdf-file-details"><b>{preview.filename}</b><span>{dateLabel(preview.coverageStart)} – {dateLabel(preview.coverageEnd)}</span></p>
      <p className="pdf-muted">Categories and transaction types are suggestions. Make any changes before these entries join your overview.</p>
      {unreadable.length > 0 && <div className="pdf-message pdf-warning">
        <h3>{pending ? `${pending} row${pending === 1 ? ' needs' : 's need'} a closer look` : 'Unreadable rows reviewed'}</h3>
        <p>Check the original PDF, then fix each row or explicitly leave it out.</p>
        {unreadable.map(row => <div className="pdf-unreadable" key={row.id}><b>{row.sourceRow}</b><p>{row.reason}</p><code>{row.rawText}</code><div className="pdf-actions"><button className="pdf-button pdf-secondary" type="button" onClick={() => repair(row)}>Fix row</button><label className="pdf-check"><input type="checkbox" checked={excluded.includes(row.id)} onChange={event => setExcluded(current => event.target.checked ? [...current, row.id] : current.filter(id => id !== row.id))} />Exclude this row</label></div></div>)}
      </div>}
      {duplicateIds.length > 0 && <p className="pdf-message pdf-warning">{duplicateIds.length} possible duplicate{duplicateIds.length === 1 ? '' : 's'} match existing entries. Remove extra rows, or choose “Keep both” for separate purchases. {remainingDuplicates} left to review.</p>}
      {editing && <div className="pdf-editor-panel" ref={editor} aria-label="Edit transaction"><h3>Edit transaction</h3><p className="pdf-muted">{editing.sourceRow}. Enter a positive amount; the transaction type determines money in or out.</p><ReviewTransactionForm key={editing.id} transaction={editing} startDate={preview.coverageStart} endDate={preview.coverageEnd} onSave={save} onCancel={() => setEditing(null)} /></div>}
      <div className="pdf-table-heading"><h3>{rows.length} transaction{rows.length === 1 ? '' : 's'} to import</h3><span className="pdf-muted">Scroll to check every entry</span></div>
      <div className="pdf-table-scroll" tabIndex={0} aria-label="Statement transactions">
        <table className="pdf-table"><thead><tr><th>Date</th><th>Transaction</th><th>Category / type</th><th className="pdf-numeric">Amount</th><th><span className="pdf-sr-only">Actions</span></th></tr></thead><tbody>
          {rows.map(row => <tr key={row.id}>
            <td><time dateTime={row.date}>{dateLabel(row.date)}</time></td>
            <td><strong>{row.description}</strong>{row.confirmedItem && <small>Your item: {row.confirmedItem}</small>}{duplicateIds.includes(row.id) && <label className="pdf-check pdf-duplicate"><input type="checkbox" checked={acknowledged.includes(row.id)} onChange={event => setAcknowledged(current => event.target.checked ? [...current, row.id] : current.filter(id => id !== row.id))} />Keep both<span className="pdf-sr-only">: {row.description} on {row.date}</span></label>}</td>
            <td><span>{CATEGORY_LABELS[row.category]}</span><small>{KIND_LABELS[row.kind]}</small></td>
            <td className={'pdf-numeric' + (row.amountPence > 0 ? ' pdf-incoming' : '')}>{row.amountPence > 0 ? '+' : '−'}{money(Math.abs(row.amountPence))}</td>
            <td><div className="pdf-row-actions"><button className="text-link" type="button" onClick={() => setEditing(row)} aria-label={`Edit ${row.description} on ${row.date}`}>Edit</button><button className="text-link pdf-remove" type="button" onClick={() => { setRows(current => current.filter(item => item.id !== row.id)); if (editing?.id === row.id) setEditing(null); }} aria-label={`Remove ${row.description} on ${row.date}`}>Remove</button></div></td>
          </tr>)}
        </tbody></table>
      </div>
      <p className="pdf-note"><span aria-hidden="true">ⓘ</span> Cash withdrawals and own-account transfers are kept in your records, but don’t count as purchases.</p>
      {excluded.length > 0 && <p className="pdf-message pdf-warning">{excluded.length} unreadable row{excluded.length === 1 ? ' will' : 's will'} be left out. Your totals will cover included entries only.</p>}
      {error && <p className="pdf-message pdf-error" role="alert">{error}</p>}
      <div className="pdf-review-footer"><button className="pdf-button pdf-secondary" type="button" onClick={onCancel}>Choose another PDF</button><button className="pdf-button pdf-primary" type="button" disabled={Boolean(pending || remainingDuplicates || editing || !rows.length)} onClick={commit}>Confirm & see spending <span aria-hidden="true">→</span></button></div>
      <p className="pdf-session-note">Nothing is added until you confirm. Reviewed entries stay in this session only.</p>
    </section>
  </div>;
}

export function PdfUploadPage() {
  const { state, dispatch } = useAppState();
  const ledger = getImportLedger(state);
  const id = useId();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [filename, setFilename] = useState('');
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);

  async function read(file: File) {
    const attempt = ++request.current;
    setBusy(true); setError(''); setFilename(file.name);
    try {
      const [next] = await Promise.all([parseStatement(file), new Promise(resolve => window.setTimeout(resolve, 850))]);
      if (attempt !== request.current) return;
      if (ledger.imports.some(item => item.fingerprint === next.fingerprint)) throw new Error('This statement is already in your records. It hasn’t been added again.');
      if (next.unresolvedRows.length || possibleDuplicateIds(next.transactions, ledger.transactions).length) {
        setPreview(next);
      } else {
        dispatch(ledgerReplacement(confirmImport(ledger, next, { transactions: next.transactions, excludedRowIds: [], acknowledgedDuplicateIds: [] })));
        dispatch({ type: 'navigation/go', route: 'dashboard' });
      }
    } catch (problem) { if (attempt === request.current) setError(problem instanceof Error ? problem.message : 'This PDF could not be read. Try the sample statement.'); }
    finally { if (attempt === request.current) setBusy(false); }
  }

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault(); setDragging(false);
    if (busy) return;
    if (event.dataTransfer.files.length !== 1) { setError('Choose one PDF at a time.'); return; }
    void read(event.dataTransfer.files[0]);
  }

  return <div className="pdf-import">
    <div className="page-heading"><div><p className="step-kicker">STEP 01 / GET STARTED</p><h1>Upload your bank statement.</h1><p>See your spending, income and next steps.</p></div><span className="heading-tag">PDF → your breakdown</span></div>
    {preview ? <StatementReview key={preview.id} preview={preview} ledger={ledger} onCancel={() => { setPreview(null); setError(''); }} onCommit={next => { dispatch(ledgerReplacement(next)); dispatch({ type: 'navigation/go', route: 'dashboard' }); }} /> :
      <section className="surface pdf-upload-card" aria-labelledby="pdf-upload-title" aria-busy={busy}>
        <div className="upload-card-top"><div><span className="file-type-label">PDF STATEMENT</span><h2 id="pdf-upload-title">Add your statement</h2></div><span className="local-badge"><span aria-hidden="true">✓</span> Processed on your device</span></div>
        <label className={'pdf-dropzone' + (dragging ? ' dragging' : '') + (busy ? ' reading' : '')} htmlFor={id} onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
          <input className="pdf-sr-only" id={id} type="file" accept="application/pdf,.pdf" disabled={busy} aria-describedby={`${id}-limits`} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void read(file); }} />
          <span className="pdf-file-icon" aria-hidden="true"><svg width="42" height="50" viewBox="0 0 32 38" fill="none"><path d="M6 1h13l7 7v27a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.5"/><path d="M19 1v8h7M10 18h10M10 23h7M10 28h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg><span>PDF</span></span>
          <strong>{busy ? 'Reading your statement…' : 'Drag and drop your PDF here'}</strong>
          <span>{busy ? filename : 'or choose a file from your device'}</span>
          {busy ? <span className="scan-track" aria-hidden="true"><i /></span> : <span className="pdf-choose">Choose a PDF <span aria-hidden="true">↑</span></span>}
          <small id={`${id}-limits`}>Text-based PDF · Up to 10 MB · 20 pages</small>
        </label>
        {busy && <p className="processing-status" role="status">Reading transactions → sorting your spending → building your breakdown</p>}
        {error && <p className="pdf-message pdf-error" role="alert">{error}</p>}
        <div className="upload-bottom"><p>Campus demo format supported for now. Other bank layouts and scanned PDFs aren’t supported yet.</p><div><button className="text-link" type="button" disabled={busy} onClick={() => void read(createSampleStatement())}>Use demo statement</button><span aria-hidden="true">·</span><button className="text-link" type="button" onClick={downloadSample}>Download sample PDF</button></div></div>
        {ledger.imports.length > 0 && <div className="imported-note"><span>✓ {ledger.imports.length} statement{ledger.imports.length === 1 ? '' : 's'} added. Uploading another adds to your records.</span><button className="text-link" onClick={() => dispatch({ type: 'navigation/go', route: 'dashboard' })}>Continue to breakdown →</button></div>}
      </section>}
  </div>;
}
