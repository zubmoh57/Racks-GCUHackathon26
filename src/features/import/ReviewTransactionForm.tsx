import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { CATEGORY_LABELS, KIND_LABELS } from './types';
import type { Category, Transaction, TransactionKind } from './types';
import { parsePounds } from './money';
import { validateTransaction } from './ledger';

interface Props {
  transaction: Transaction;
  startDate: string;
  endDate: string;
  onSave: (transaction: Transaction) => void;
  onCancel: () => void;
}

export function ReviewTransactionForm({ transaction, startDate, endDate, onSave, onCancel }: Props) {
  const id = useId();
  const [date, setDate] = useState(transaction.date);
  const [description, setDescription] = useState(transaction.description);
  const [amount, setAmount] = useState(transaction.amountPence ? (Math.abs(transaction.amountPence) / 100).toFixed(2) : '');
  const [category, setCategory] = useState(transaction.category);
  const [kind, setKind] = useState(transaction.kind);
  const [direction, setDirection] = useState(transaction.amountPence > 0 ? 'in' : 'out');
  const [item, setItem] = useState(transaction.confirmedItem ?? '');
  const [error, setError] = useState('');

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const pence = parsePounds(amount);
      if (pence <= 0) throw new Error('Enter an amount greater than zero.');
      const incoming = kind === 'transfer' ? direction === 'in' : ['income', 'funding', 'refund'].includes(kind);
      const updated: Transaction = {
        ...transaction, date, description: description.trim(), merchant: description.trim(),
        amountPence: incoming ? pence : -pence, category, kind, confirmedItem: item.trim() || undefined,
      };
      const problem = validateTransaction(updated);
      if (problem) throw new Error(problem);
      if (date < startDate || date > endDate) throw new Error('The date must be within this statement period.');
      onSave(updated);
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Check the transaction details.'); }
  }

  return <form className="pdf-edit-form" onSubmit={save}>
    <div className="pdf-form-grid">
      <label htmlFor={`${id}-date`}>Date<input id={`${id}-date`} type="date" min={startDate} max={endDate} value={date} onChange={event => setDate(event.target.value)} required /></label>
      <label htmlFor={`${id}-description`}>Description<input id={`${id}-description`} value={description} onChange={event => setDescription(event.target.value)} maxLength={160} required /></label>
      <label htmlFor={`${id}-amount`}>Amount (£)<input id={`${id}-amount`} inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="3.50" required /></label>
      <label htmlFor={`${id}-category`}>Category<select id={`${id}-category`} value={category} onChange={event => setCategory(event.target.value as Category)}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label htmlFor={`${id}-kind`}>Transaction type<select id={`${id}-kind`} value={kind} onChange={event => setKind(event.target.value as TransactionKind)}>{Object.entries(KIND_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      {kind === 'transfer' && <label htmlFor={`${id}-direction`}>Transfer direction<select id={`${id}-direction`} value={direction} onChange={event => setDirection(event.target.value)}><option value="out">Money out</option><option value="in">Money in</option></select></label>}
      <label htmlFor={`${id}-item`}>What was it? <span>(optional)</span><input id={`${id}-item`} value={item} onChange={event => setItem(event.target.value)} placeholder="e.g. Your favourite cake" maxLength={120} /></label>
    </div>
    {error && <p className="pdf-message pdf-error" role="alert">{error}</p>}
    <div className="pdf-actions"><button className="pdf-button pdf-primary" type="submit">Save changes</button><button className="pdf-button pdf-secondary" type="button" onClick={onCancel}>Cancel edit</button></div>
  </form>;
}
