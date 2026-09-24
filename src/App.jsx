import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { decodeTrip, encodeTrip, makeEmptyTrip } from './lib/codec.js'
import { calculateSettlement, formatMoney } from './lib/settlement.js'
import { createId, createParticipantId, createTransactionId } from './lib/ids.js'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const categories = ['Nocleg', 'Transport', 'Jedzenie', 'Atrakcje', 'Zakupy', 'Inne']
const today = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function Icon({ name, size = 18 }) {
  const paths = {
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    receipt: <><path d="M6 2h12a2 2 0 0 1 2 2v18l-4-2-4 2-4-2-4 2V4a2 2 0 0 1 2-2Z"/><path d="M8 7h8M8 11h8M8 15h5"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/></>,
    copy: <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></>,
    upload: <><path d="M12 21V9M7 14l5-5 5 5M5 3h14"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    unlock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/></>,
    spark: <><path d="m12 3-1.4 4.1a5.5 5.5 0 0 1-3.5 3.5L3 12l4.1 1.4a5.5 5.5 0 0 1 3.5 3.5L12 21l1.4-4.1a5.5 5.5 0 0 1 3.5-3.5L21 12l-4.1-1.4a5.5 5.5 0 0 1-3.5-3.5L12 3Z"/></>,
    check: <><path d="m5 12 4 4L19 6"/></>,
    warning: <><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
    x: <><path d="m6 6 12 12M18 6 6 18"/></>,
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></>,
    chevron: <><path d="m9 18 6-6-6-6"/></>,
  }
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function initialDraft() {
  try {
    const stored = localStorage.getItem('trip-bill-draft')
    return stored ? decodeTrip(stored) : makeEmptyTrip()
  } catch { return makeEmptyTrip() }
}

function currentIdentifier() {
  const match = window.location.pathname.match(/^\/trip\/([A-Za-z0-9]{10})\/?$/)
  return match ? match[1].toUpperCase() : ''
}

function App() {
  const [trip, setTrip] = useState(initialDraft)
  const [participantName, setParticipantName] = useState('')
  const [transaction, setTransaction] = useState({ date: today(), description: '', category: 'Atrakcje', paidBy: '', amount: '', split: 'all', beneficiary: '' })
  const [shareCode, setShareCode] = useState('')
  const [importCode, setImportCode] = useState('')
  const [identifier, setIdentifier] = useState(currentIdentifier)
  const [password, setPassword] = useState('')
  const [loadedExisting, setLoadedExisting] = useState(false)
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [activePanel, setActivePanel] = useState('export')
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(Boolean(currentIdentifier()))
  const participantInputRef = useRef(null)
  const settlement = useMemo(() => calculateSettlement(trip.participants, trip.transactions), [trip])
  const peopleById = useMemo(() => new Map(trip.participants.map((person) => [person.id, person.name])), [trip.participants])

  useEffect(() => { localStorage.setItem('trip-bill-draft', encodeTrip(trip)) }, [trip])
  useEffect(() => {
    const id = currentIdentifier()
    if (id) loadFromDatabase(id, '')
    // URL jest odczytywany tylko podczas uruchamiania aplikacji.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function notify(type, message) {
    setStatus({ type, message })
    window.clearTimeout(notify.timer)
    notify.timer = window.setTimeout(() => setStatus(null), 5000)
  }

  function addParticipant(event) {
    event.preventDefault()
    const name = participantName.trim().replace(/\s+/g, ' ')
    if (!name) return
    if (trip.participants.some((person) => person.name.toLocaleLowerCase('pl') === name.toLocaleLowerCase('pl'))) {
      notify('error', 'Taki uczestnik jest już na liście.')
      return
    }
    const participant = { id: createParticipantId(), name }
    setTrip((current) => ({ ...current, participants: [...current.participants, participant] }))
    setTransaction((current) => ({ ...current, paidBy: current.paidBy || participant.id, beneficiary: current.beneficiary || participant.id }))
    setParticipantName('')
    participantInputRef.current?.focus()
  }

  function removeParticipant(person) {
    if (trip.transactions.some((item) => item.paidBy === person.id || item.beneficiary === person.id)) {
      notify('error', `Nie można usunąć ${person.name}, bo występuje w transakcjach.`)
      return
    }
    setTrip((current) => ({ ...current, participants: current.participants.filter((item) => item.id !== person.id) }))
  }

  function addTransaction(event) {
    event.preventDefault()
    const amount = Number(String(transaction.amount).replace(',', '.'))
    if (trip.participants.length < 1) return notify('error', 'Najpierw dodaj przynajmniej jednego uczestnika.')
    if (!transaction.description.trim() || !transaction.paidBy || !Number.isFinite(amount) || amount <= 0) return notify('error', 'Uzupełnij opis, płatnika i poprawną kwotę.')
    if (transaction.split === 'person' && !transaction.beneficiary) return notify('error', 'Wskaż osobę, której dotyczył wydatek.')
    setTrip((current) => ({
      ...current,
      transactions: [{ id: createTransactionId(), date: transaction.date, description: transaction.description.trim(), category: transaction.category.trim() || 'Inne', paidBy: transaction.paidBy, amount: Math.round(amount * 100) / 100, split: transaction.split, beneficiary: transaction.split === 'person' ? transaction.beneficiary : null }, ...current.transactions],
    }))
    setTransaction((current) => ({ ...current, description: '', amount: '' }))
    notify('success', 'Wydatek został dodany.')
  }

  function exportData() {
    const code = encodeTrip(trip)
    setShareCode(code)
    setActivePanel('export')
    navigator.clipboard?.writeText(code).then(() => notify('success', 'Kod eksportu skopiowany do schowka.')).catch(() => notify('success', 'Kod eksportu jest gotowy do skopiowania.'))
  }

  function importData() {
    try {
      const imported = decodeTrip(importCode)
      setTrip(imported)
      setIdentifier('')
      setLoadedExisting(false)
      setPassword('')
      setPasswordRequired(false)
      window.history.replaceState({}, '', '/')
      notify('success', `Zaimportowano ${imported.participants.length} uczestników i ${imported.transactions.length} transakcji.`)
    } catch (error) { notify('error', error.message || 'Nie udało się odczytać kodu.') }
  }

  function generateIdentifier() {
    setIdentifier(createId())
    setLoadedExisting(false)
    setPasswordRequired(false)
    notify('success', 'Wygenerowano nowy identyfikator.')
  }

  async function request(path, options) {
    const response = await fetch(`${API_BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(body.error || 'Wystąpił błąd połączenia z serwerem.')
      error.status = response.status
      error.body = body
      throw error
    }
    return body
  }

  async function saveToDatabase() {
    const id = identifier.trim().toUpperCase()
    if (!/^[A-Z0-9]{10}$/.test(id)) return notify('error', 'Identyfikator musi mieć dokładnie 10 liter lub cyfr.')
    if (trip.participants.length === 0) return notify('error', 'Dodaj uczestników przed zapisaniem rozliczenia.')
    setSaving(true)
    try {
      const result = await request(loadedExisting ? `/trips/${id}` : '/trips', { method: loadedExisting ? 'PUT' : 'POST', body: JSON.stringify({ id, payload: encodeTrip(trip), password }) })
      setIdentifier(result.id)
      setLoadedExisting(true)
      setPasswordRequired(false)
      window.history.replaceState({}, '', `/trip/${result.id}`)
      notify('success', result.updated ? 'Zapisano zmiany w rozliczeniu.' : 'Rozliczenie zapisane. Link jest gotowy do udostępnienia.')
    } catch (error) {
      if (error.status === 409) notify('error', 'Ten identyfikator już istnieje. Wygeneruj nowy lub otwórz istniejący.')
      else if (error.status === 401) { setPasswordRequired(true); notify('error', 'Nieprawidłowe hasło do tego rozliczenia.') }
      else notify('error', error.message)
    } finally { setSaving(false) }
  }

  async function loadFromDatabase(candidate = identifier, suppliedPassword = password) {
    const id = candidate.trim().toUpperCase()
    if (!/^[A-Z0-9]{10}$/.test(id)) return notify('error', 'Wpisz 10-znakowy identyfikator.')
    setLoading(true)
    try {
      const result = await request(`/trips/${id}/load`, { method: 'POST', body: JSON.stringify({ password: suppliedPassword }) })
      setTrip(decodeTrip(result.payload))
      setIdentifier(result.id)
      setLoadedExisting(true)
      setPasswordRequired(false)
      window.history.replaceState({}, '', `/trip/${result.id}`)
      notify('success', 'Rozliczenie zostało wczytane.')
    } catch (error) {
      if (error.status === 401 && error.body?.passwordRequired) { setIdentifier(id); setPasswordRequired(true); notify('error', suppliedPassword ? 'Hasło jest nieprawidłowe.' : 'To rozliczenie wymaga hasła.') }
      else if (error.status === 404) notify('error', 'Nie znaleziono rozliczenia o takim identyfikatorze.')
      else notify('error', error.message)
    } finally { setLoading(false) }
  }

  function copyLink() {
    if (!identifier) return
    navigator.clipboard?.writeText(`${window.location.origin}/trip/${identifier}`).then(() => notify('success', 'Link skopiowany do schowka.')).catch(() => notify('error', 'Nie udało się skopiować linku.'))
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Wyjazd się liczy — strona główna"><span className="brand-mark"><Icon name="spark" size={21} /></span><span>Wyjazd się liczy</span></a>
        <div className="open-trip"><label htmlFor="open-id">Otwórz rozliczenie</label><div className="inline-field"><input id="open-id" value={identifier} maxLength={10} placeholder="NP. K8F3D2Q9LM" onChange={(event) => { setIdentifier(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setLoadedExisting(false); setPasswordRequired(false) }} onKeyDown={(event) => event.key === 'Enter' && loadFromDatabase()} /><button className="icon-button dark" type="button" onClick={() => loadFromDatabase()} disabled={loading} aria-label="Wczytaj rozliczenie"><Icon name="arrow" /></button></div></div>
      </header>

      <main>
        <section className="intro"><div><span className="eyebrow">Wspólne wydatki, prosty finał</span><h1>Rozlicz wyjazd.<br/><em>Bez liczenia na palcach.</em></h1><p>Dodaj uczestników i wydatki. My policzymy, kto komu i ile powinien oddać.</p></div><div className="intro-actions"><button className="button secondary" type="button" onClick={exportData}><Icon name="download"/> Eksportuj dane</button><button className="button primary" type="button" onClick={() => document.getElementById('transaction-description')?.focus()}><Icon name="plus"/> Dodaj wydatek</button></div></section>
        {status && <div className={`toast ${status.type}`} role="status"><Icon name={status.type === 'success' ? 'check' : 'warning'} /><span>{status.message}</span><button type="button" onClick={() => setStatus(null)} aria-label="Zamknij komunikat"><Icon name="x" size={16}/></button></div>}
        {passwordRequired && <section className="password-callout"><span className="callout-icon"><Icon name="lock" /></span><div><strong>Rozliczenie {identifier} jest zabezpieczone</strong><span>Podaj hasło, aby odszyfrować dane.</span></div><input type="password" value={password} autoFocus placeholder="Hasło" onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && loadFromDatabase()} /><button className="button dark-button" type="button" onClick={() => loadFromDatabase()} disabled={loading}>{loading ? 'Wczytywanie…' : 'Odblokuj'}</button></section>}

        {!loading && !passwordRequired && <div className="workspace">
          <div className="workspace-main">
            <section className="card participants-card">
              <div className="section-heading"><span className="section-icon mint"><Icon name="users" /></span><div><h2>Uczestnicy</h2><p>Dodaj każdą osobę, która bierze udział w rozliczeniu.</p></div><span className="count-badge">{trip.participants.length}</span></div>
              <form className="participant-form" onSubmit={addParticipant}><input ref={participantInputRef} value={participantName} onChange={(event) => setParticipantName(event.target.value)} placeholder="Imię uczestnika" aria-label="Imię uczestnika" maxLength={60}/><button className="button light-button" type="submit"><Icon name="plus"/> Dodaj</button></form>
              <div className="participant-list">{trip.participants.length === 0 ? <div className="empty-inline">Lista jest pusta. Zacznij od dodania uczestników.</div> : trip.participants.map((person, index) => <span className="person-chip" key={person.id}><span className={`avatar avatar-${index % 6}`}>{person.name.slice(0, 1).toUpperCase()}</span>{person.name}<button type="button" onClick={() => removeParticipant(person)} aria-label={`Usuń ${person.name}`}><Icon name="x" size={14}/></button></span>)}</div>
            </section>

            <section className="card expense-card">
              <div className="section-heading"><span className="section-icon coral"><Icon name="receipt" /></span><div><h2>Nowy wydatek</h2><p>Kto zapłacił, za co i jak podzielić koszt?</p></div></div>
              <form className="expense-form" onSubmit={addTransaction}>
                <div className="field wide"><label htmlFor="transaction-description">Opis wydatku</label><input id="transaction-description" value={transaction.description} onChange={(event) => setTransaction({...transaction, description: event.target.value})} placeholder="np. Bilety do aquaparku" maxLength={120}/></div>
                <div className="field amount-field"><label htmlFor="transaction-amount">Kwota</label><div className="input-suffix"><input id="transaction-amount" inputMode="decimal" value={transaction.amount} onChange={(event) => setTransaction({...transaction, amount: event.target.value})} placeholder="0,00"/><span>PLN</span></div></div>
                <div className="field"><label htmlFor="transaction-payer">Zapłacił(a)</label><select id="transaction-payer" value={transaction.paidBy} onChange={(event) => setTransaction({...transaction, paidBy: event.target.value})}><option value="">Wybierz osobę</option>{trip.participants.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div>
                <div className="field"><label htmlFor="transaction-date">Data</label><input id="transaction-date" type="date" value={transaction.date} onChange={(event) => setTransaction({...transaction, date: event.target.value})}/></div>
                <div className="field"><label htmlFor="transaction-category">Kategoria</label><input id="transaction-category" list="category-options" value={transaction.category} onChange={(event) => setTransaction({...transaction, category: event.target.value})}/><datalist id="category-options">{categories.map((item) => <option value={item} key={item}/>)}</datalist></div>
                <fieldset className="field split-field"><legend>Podział kosztu</legend><div className="segmented"><label className={transaction.split === 'all' ? 'selected' : ''}><input type="radio" name="split" checked={transaction.split === 'all'} onChange={() => setTransaction({...transaction, split: 'all'})}/>Wszyscy po równo</label><label className={transaction.split === 'person' ? 'selected' : ''}><input type="radio" name="split" checked={transaction.split === 'person'} onChange={() => setTransaction({...transaction, split: 'person'})}/>Wybrana osoba</label></div></fieldset>
                {transaction.split === 'person' && <div className="field beneficiary-field"><label htmlFor="transaction-beneficiary">Dla kogo?</label><select id="transaction-beneficiary" value={transaction.beneficiary} onChange={(event) => setTransaction({...transaction, beneficiary: event.target.value})}><option value="">Wybierz osobę</option>{trip.participants.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div>}
                <button className="button primary submit-expense" type="submit"><Icon name="plus"/> Dodaj wydatek</button>
              </form>
            </section>

            <section className="card transactions-card">
              <div className="section-heading compact-heading"><div><h2>Historia wydatków</h2><p>{trip.transactions.length ? `${trip.transactions.length} ${trip.transactions.length === 1 ? 'pozycja' : 'pozycji'} w rozliczeniu` : 'Dodane wydatki pojawią się tutaj.'}</p></div></div>
              {trip.transactions.length === 0 ? <div className="empty-state"><span><Icon name="receipt" size={25}/></span><strong>Jeszcze bez wydatków</strong><p>Dodaj pierwszy koszt, aby zobaczyć automatyczne rozliczenie.</p></div> : <div className="transaction-list">{trip.transactions.map((item) => <div className="transaction-row" key={item.id}><span className="category-dot">{item.category.slice(0, 1).toUpperCase()}</span><div className="transaction-copy"><strong>{item.description}</strong><span>{peopleById.get(item.paidBy) || 'Nieznany płatnik'} · {item.category} · {item.date || 'bez daty'}</span><small>{item.split === 'all' ? 'Podział na wszystkich' : `Dla: ${peopleById.get(item.beneficiary) || 'nieznana osoba'}`}</small></div><strong className="transaction-amount">{formatMoney(item.amount)}</strong><button className="icon-button ghost" type="button" onClick={() => setTrip((current) => ({ ...current, transactions: current.transactions.filter((transactionItem) => transactionItem.id !== item.id) }))} aria-label={`Usuń ${item.description}`}><Icon name="trash" size={17}/></button></div>)}</div>}
            </section>
          </div>

          <aside className="summary-column">
            <section className="card summary-card">
              <div className="summary-title"><div><span className="eyebrow">Podsumowanie</span><h2>Bilans wyjazdu</h2></div><span className="summary-spark"><Icon name="spark"/></span></div>
              <div className="total-block"><span>Łączne wydatki</span><strong>{formatMoney(settlement.total / 100)}</strong></div>
              <div className="metric-grid"><div><span>Wspólne / os.</span><strong>{formatMoney(settlement.averageCommon / 100)}</strong></div><div><span>Liczba wydatków</span><strong>{settlement.expenseCount}</strong></div></div>
              <div className="summary-section"><div className="mini-heading"><h3>Salda uczestników</h3><span>{settlement.balances.length}</span></div>{settlement.balances.length === 0 ? <p className="summary-empty">Dodaj uczestników, aby policzyć salda.</p> : <div className="balance-list">{settlement.balances.map((balance, index) => <div className="balance-row" key={balance.id}><span className={`avatar avatar-${index % 6}`}>{balance.name.slice(0, 1).toUpperCase()}</span><div><strong>{balance.name}</strong><span>zapłacono {formatMoney(balance.paid / 100)}</span></div><strong className={balance.balance > 0 ? 'positive' : balance.balance < 0 ? 'negative' : ''}>{balance.balance > 0 ? '+' : ''}{formatMoney(balance.balance / 100)}</strong></div>)}</div>}</div>
              <div className="summary-section transfers-section"><div className="mini-heading"><h3>Przelewy do wykonania</h3><span>{settlement.transfers.length}</span></div>{settlement.transfers.length === 0 ? <div className="settled"><span><Icon name="check"/></span><div><strong>{trip.transactions.length ? 'Wszystko rozliczone' : 'Tu pojawią się przelewy'}</strong><p>{trip.transactions.length ? 'Nikt nikomu nic nie jest winny.' : 'Dodaj wydatki, a policzymy najprostsze rozliczenie.'}</p></div></div> : settlement.transfers.map((transfer) => <div className="transfer-row" key={`${transfer.fromId}-${transfer.toId}`}><div><strong>{transfer.from}</strong><span>płaci</span></div><span className="transfer-arrow"><Icon name="chevron" size={15}/></span><div><strong>{transfer.to}</strong><span>otrzymuje</span></div><strong>{formatMoney(transfer.amount / 100)}</strong></div>)}</div>
            </section>

            <section className="card share-card">
              <div className="share-tabs" role="tablist"><button className={activePanel === 'export' ? 'active' : ''} type="button" onClick={() => setActivePanel('export')}><Icon name="download" size={15}/> Eksport</button><button className={activePanel === 'import' ? 'active' : ''} type="button" onClick={() => setActivePanel('import')}><Icon name="upload" size={15}/> Import</button><button className={activePanel === 'cloud' ? 'active' : ''} type="button" onClick={() => setActivePanel('cloud')}><Icon name="link" size={15}/> Link</button></div>
              {activePanel === 'export' && <div className="share-content"><h3>Eksportuj kod</h3><p>Zapisz uczestników i transakcje w jednym przenośnym kodzie.</p>{shareCode && <textarea value={shareCode} readOnly aria-label="Kod eksportu"/>}<button className="button full-button" type="button" onClick={exportData}><Icon name="copy"/> {shareCode ? 'Kopiuj ponownie' : 'Generuj i kopiuj'}</button></div>}
              {activePanel === 'import' && <div className="share-content"><h3>Importuj kod</h3><p>Wklejenie kodu zastąpi bieżący szkic.</p><textarea value={importCode} onChange={(event) => setImportCode(event.target.value.trim())} placeholder="Wklej kod eksportu…" aria-label="Kod do importu"/><button className="button full-button" type="button" onClick={importData} disabled={!importCode}><Icon name="upload"/> Importuj dane</button></div>}
              {activePanel === 'cloud' && <div className="share-content"><h3>Zapisz pod linkiem</h3><p>Identyfikator działa w adresie strony. Hasło jest opcjonalne.</p><label htmlFor="share-id">Identyfikator</label><div className="inline-field share-id-field"><input id="share-id" value={identifier} maxLength={10} placeholder="10 ZNAKÓW" onChange={(event) => { setIdentifier(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setLoadedExisting(false) }}/><button className="icon-button" type="button" onClick={generateIdentifier} aria-label="Generuj identyfikator"><Icon name="spark"/></button></div><label htmlFor="share-password">Hasło <span>(opcjonalnie)</span></label><div className="password-field"><Icon name={password ? 'lock' : 'unlock'} size={16}/><input id="share-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Bez hasła = dostęp publiczny"/></div><button className="button full-button primary" type="button" onClick={saveToDatabase} disabled={saving}><Icon name="save"/> {saving ? 'Zapisywanie…' : loadedExisting ? 'Zapisz zmiany' : 'Zapisz rozliczenie'}</button>{loadedExisting && <button className="text-button" type="button" onClick={copyLink}><Icon name="copy" size={15}/> Kopiuj link do rozliczenia</button>}</div>}
            </section>
          </aside>
        </div>}
      </main>
      <footer><span>Wyjazd się liczy</span><span>Dane szkicu są zapisywane lokalnie w tej przeglądarce.</span></footer>
    </div>
  )
}

export default App
