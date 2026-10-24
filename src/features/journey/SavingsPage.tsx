import { useState } from 'react'
import { useAppState } from '../../../useAppState'
import type { Transaction } from '../../assets/contracts'
import { analyseStatement } from '../../../savings/engine/index.js'
import { savingsInput } from './savingsAdapter'
import { money, monthsCovered, swapSaving } from './finance'

interface Swap {
  id: string; title: string; from: string; to: string; paid: number; alternative: number | null
  note: string; url: string; badge: string; example?: boolean
  /** Only where the statements record both prices: what those past purchases would have cost instead. */
  occurrences?: number; totalSaving?: number
}
const discounts = [
  { name: 'Co-op', mark: 'co-op', title: '10% off with Young Scot', detail: 'Show an eligible Young Scot card in store. Check current exclusions before buying.', url: 'https://www.coop.co.uk/in-store-services/student-discount', match: /tesco|co-?op|grocer/i, tag: 'FOOD & ESSENTIALS' },
  { name: 'Spotify', mark: '♫', title: 'Premium Student', detail: 'Student pricing for eligible higher-education students. Verification and time limits apply; check the current price.', url: 'https://www.spotify.com/uk/student/', match: /spotify/i, tag: 'MUSIC' },
  { name: 'Transport Scotland', mark: '↗', title: 'Under 22? Check free bus travel', detail: 'For residents of Scotland aged 5–21 with the right National Entitlement Card. Apply before travelling.', url: 'https://www.transport.gov.scot/concessionary-travel/under-22s-free-bus-travel', match: /bus|first glasgow|transport/i, tag: 'GETTING AROUND' },
  { name: 'Glasgow Life', mark: 'Aa', title: 'Free library membership', detail: 'For people who live, work or study in Glasgow. Check whether your title is available to borrow.', url: 'https://www.glasgowlife.org.uk/libraries/join-the-library', match: /waterstones|book|kindle/i, tag: 'BOOKS & LEARNING' },
]

export function SavingsPage() {
  const { state, dispatch } = useAppState()
  const [tab, setTab] = useState<'swaps' | 'discounts'>('swaps')
  const eligible = savingsInput(state.transactions, [])
  const analysis = analyseStatement({ transactions: eligible, maxRecommendations: 5 })
  const swaps: Swap[] = []
  const matching = (pattern: RegExp) => state.transactions.filter(row => row.kind === 'expense' && eligible.some(item => item.id === row.id) && pattern.test(`${row.description} ${row.merchant ?? ''}`))
  const spent = (rows: readonly Transaction[]) => rows.reduce((sum, row) => sum - row.amountPence, 0)
  const average = (rows: readonly Transaction[]) => rows.length ? Math.round(spent(rows) / rows.length) : null
  const starbucksRows = matching(/starbucks/i), blackSheepRows = matching(/black sheep/i)
  const starbucks = average(starbucksRows), blackSheep = average(blackSheepRows)
  if (starbucks !== null && blackSheep !== null && blackSheep < starbucks) swaps.push({ id: 'coffee-comparison', title: 'Compare your coffee stops', from: 'Starbucks', to: 'Black Sheep Coffee', paid: starbucks, alternative: blackSheep, note: 'Recorded purchase averages before refunds. Items and sizes may differ; this is not a verified like-for-like price.', url: 'https://www.blacksheepcoffee.com/', badge: 'YOUR RECORDED PRICES', ...swapSaving(starbucksRows.map(row => -row.amountPence), blackSheep) })
  const books = eligible.filter(row => row.category === 'tuition')
  if (books.length) swaps.push({ id: 'library-swap', title: 'Borrow your next read', from: books[0].merchant ?? books[0].description, to: 'Glasgow Life Libraries', paid: Math.round(books[0].amount * 100), alternative: 0, note: 'Membership is free if you live, work or study in Glasgow. Your specific title may not be available.', url: 'https://www.glasgowlife.org.uk/libraries/join-the-library', badge: 'FREE ALTERNATIVE', ...swapSaving(books.map(book => Math.round(book.amount * 100)), 0) })
  if (eligible.some(row => /tesco/i.test(row.description))) swaps.push({ id: 'sandwich-example', title: 'Same lunch idea. A smaller price.', from: 'Tesco · example sandwich', to: 'Co-op · example sandwich', paid: 350, alternative: 300, note: 'Illustrative prices only, not live offers or an identified statement item. Check product, portion and local shelf price.', url: 'https://www.coop.co.uk/products', badge: 'EXAMPLE COMPARISON', example: true })
  for (const recommendation of analysis.recommendations) {
    if (swaps.length >= 4 || recommendation.kind === 'encouragement' || recommendation.offers.some(offer => offer.supportOnly) || recommendation.categoryId === 'tuition') continue
    const offer = recommendation.offers[0]
    if (!offer) continue
    swaps.push({ id: recommendation.id, title: recommendation.title, from: `${recommendation.evidence.transactionCount} recorded purchase${recommendation.evidence.transactionCount === 1 ? '' : 's'}`, to: offer.provider, paid: Math.round(recommendation.evidence.total * 100), alternative: null, note: 'An option to explore based on your spending. Eligibility, availability and current prices need checking.', url: offer.url, badge: 'BASED ON YOUR ACTIVITY' })
  }

  const priced = swaps.filter(swap => !swap.example && swap.totalSaving)
  const total = priced.reduce((sum, swap) => sum + swap.totalSaving!, 0)
  const months = monthsCovered(state.coverage)
  const period = months === 1 ? 'a month' : `${months} months`

  return <div>
    <div className="page-heading"><div><p className="step-kicker">STEP 03 / FIND SAVINGS</p><h1>Potential savings.</h1></div><span className="heading-tag">Alternatives, discounts and free options</span></div>
    <section className="surface savings-panel" aria-label="Savings and student discounts">
      <div className="savings-panel-header"><div className="content-tabs" role="tablist" aria-label="Saving options" onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const next = event.key === 'Home' ? 'swaps' : event.key === 'End' ? 'discounts' : tab === 'swaps' ? 'discounts' : 'swaps'
        setTab(next)
        event.currentTarget.querySelector<HTMLButtonElement>(`#${next}-tab`)?.focus()
      }}><button id="swaps-tab" role="tab" tabIndex={tab === 'swaps' ? 0 : -1} aria-controls="swaps-panel" aria-selected={tab === 'swaps'} onClick={() => setTab('swaps')}>Potential savings</button><button id="discounts-tab" role="tab" tabIndex={tab === 'discounts' ? 0 : -1} aria-controls="discounts-panel" aria-selected={tab === 'discounts'} onClick={() => setTab('discounts')}>Student discounts <span className="count-badge">{discounts.length}</span></button></div><span className="subtle">For Glasgow students</span></div>
      {tab === 'swaps' ? <div id="swaps-panel" role="tabpanel" aria-labelledby="swaps-tab"><div className="swaps-intro"><b>A few swaps worth a look.</b><span>Bank statements name shops, not individual products. Compare the details before switching.</span></div>
        {swaps.map(swap => <article className="swap-row" key={swap.id}>
          <div className="swap-description"><span className={'offer-kicker' + (swap.example ? ' example-kicker' : '')}>{swap.badge}</span><h2>{swap.title}</h2><p>{swap.note}</p>{swap.totalSaving ? <p className="swap-total">Across your <b>{swap.occurrences} recorded purchase{swap.occurrences === 1 ? '' : 's'}</b> in {period}, that is <b>{money(swap.totalSaving)}</b> you would have kept.</p> : null}</div>
          <div className="swap-comparison"><div className="swap-from"><span>{swap.example ? 'EXAMPLE PRICE' : 'YOU RECORDED'}</span><b>{swap.from}</b><strong>{money(swap.paid)}</strong></div><span className="comparison-arrow" aria-hidden="true">⟶</span><div className="swap-to"><span>{swap.example ? 'EXAMPLE ALTERNATIVE' : 'TAKE A LOOK AT'}</span><b>{swap.to}</b><strong>{swap.alternative === null ? 'Check offers' : money(swap.alternative)}</strong></div></div>
          <div className="swap-actions"><a className="offer-link" href={swap.url} target="_blank" rel="noreferrer">{swap.alternative === 0 ? 'Check library availability' : 'Check provider'} ↗</a></div>
        </article>)}
        {total > 0 && <div className="savings-total">
          <div><span className="offer-kicker">ACROSS {period.toUpperCase()} OF STATEMENTS</span><strong>{money(total)}</strong><span>you would have kept in total</span></div>
          <small>Added up from the {priced.length} swap{priced.length === 1 ? '' : 's'} above where your own statements record both prices. Example comparisons and “check offers” suggestions are not counted. Recorded prices, not verified like-for-like products.</small>
        </div>}
        {!swaps.length && <p className="empty-state">No specific swaps found yet. Try the Student discounts tab, or add an item description to a transaction.</p>}
      </div> : <div id="discounts-panel" role="tabpanel" aria-labelledby="discounts-tab"><div className="swaps-intro"><b>Your student status has perks.</b><span>Provider pages checked 24 October 2026. Offers can change; eligibility matters.</span></div><div className="discount-grid">{discounts.map(discount => <article className="discount-item" key={discount.name}><span className="discount-mark">{discount.mark}</span><div><span className="offer-kicker">{discount.tag}{state.transactions.some(row => discount.match.test(row.description)) ? ' · MATCHES YOUR ACTIVITY' : ''}</span><h2>{discount.title}</h2><p>{discount.detail}</p><a href={discount.url} target="_blank" rel="noreferrer">Check {discount.name} ↗</a></div></article>)}</div></div>}
    </section>
    <div className="page-actions"><button className="back-button" onClick={() => dispatch({ type: 'navigation/go', route: 'dashboard' })}>← Your breakdown</button><button className="primary-button" onClick={() => dispatch({ type: 'navigation/go', route: 'planning' })}>Build your money plan <span aria-hidden="true">→</span></button></div>
  </div>
}
