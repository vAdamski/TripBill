import { createParticipantId, createTransactionId } from './ids.js'

const VERSION = 1
export function makeEmptyTrip() { return { participants: [], transactions: [] } }

function bytesToBase64(bytes) {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}
function base64ToBytes(value) { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)) }
function toBase64Url(text) { return bytesToBase64(new TextEncoder().encode(text)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '') }
function fromBase64Url(value) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  return new TextDecoder().decode(base64ToBytes(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')))
}

function portableTrip(trip) {
  const names = new Map(trip.participants.map((person) => [person.id, person.name]))
  return {
    version: VERSION,
    participants: trip.participants.map((person) => person.name),
    transactions: trip.transactions.map((transaction) => ({ id: transaction.id, date: transaction.date || '', description: transaction.description, category: transaction.category || 'Inne', paidBy: names.get(transaction.paidBy), amount: Number(transaction.amount), split: transaction.split === 'person' ? 'person' : 'all', beneficiary: transaction.split === 'person' ? names.get(transaction.beneficiary) : null })),
  }
}

export function encodeTrip(trip) { return toBase64Url(JSON.stringify(portableTrip(trip))) }

export function decodeTrip(code) {
  if (typeof code !== 'string' || !code.trim()) throw new Error('Kod importu jest pusty.')
  let data
  try { const cleaned = code.trim(); data = JSON.parse(cleaned.startsWith('{') ? cleaned : fromBase64Url(cleaned)) } catch { throw new Error('Kod importu ma nieprawidłowy format.') }
  if (data.version !== VERSION || !Array.isArray(data.participants) || !Array.isArray(data.transactions)) throw new Error('Kod pochodzi z nieobsługiwanej wersji aplikacji.')
  if (data.participants.length > 200 || data.transactions.length > 5000) throw new Error('Kod zawiera zbyt dużo danych.')
  const participants = []
  const idsByName = new Map()
  for (const entry of data.participants) {
    const name = String(typeof entry === 'string' ? entry : entry?.name || '').trim().replace(/\s+/g, ' ')
    const normalizedName = name.toLocaleLowerCase('pl')
    if (!name || name.length > 60 || idsByName.has(normalizedName)) throw new Error('Lista uczestników zawiera puste lub powtórzone imię.')
    const id = createParticipantId()
    idsByName.set(normalizedName, id)
    participants.push({ id, name })
  }
  const transactions = data.transactions.map((entry) => {
    const paidBy = idsByName.get(String(entry.paidBy || '').toLocaleLowerCase('pl'))
    const beneficiary = entry.beneficiary ? idsByName.get(String(entry.beneficiary).toLocaleLowerCase('pl')) : null
    const amount = Number(entry.amount)
    const split = entry.split === 'person' ? 'person' : 'all'
    if (!paidBy || !Number.isFinite(amount) || amount <= 0 || !String(entry.description || '').trim()) throw new Error('Kod zawiera nieprawidłową transakcję.')
    if (split === 'person' && !beneficiary) throw new Error('Transakcja indywidualna wskazuje osobę spoza listy.')
    return { id: typeof entry.id === 'string' && entry.id ? entry.id : createTransactionId(), date: /^\d{4}-\d{2}-\d{2}$/.test(entry.date || '') ? entry.date : '', description: String(entry.description).trim().slice(0, 120), category: String(entry.category || 'Inne').trim().slice(0, 60) || 'Inne', paidBy, amount: Math.round(amount * 100) / 100, split, beneficiary: split === 'person' ? beneficiary : null }
  })
  return { participants, transactions }
}
