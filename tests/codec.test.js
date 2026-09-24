import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeTrip, encodeTrip } from '../src/lib/codec.js'

test('eksport i import zachowują osoby oraz transakcje z polskimi znakami', () => {
  const trip = {
    participants: [{ id: 'a', name: 'Łukasz' }, { id: 'b', name: 'Żaneta' }],
    transactions: [{ id: 't1', date: '2026-09-21', description: 'Żółta łódź', category: 'Atrakcje', paidBy: 'a', amount: 54.12, split: 'person', beneficiary: 'b' }],
  }
  const decoded = decodeTrip(encodeTrip(trip))
  assert.deepEqual(decoded.participants.map(({ name }) => name), ['Łukasz', 'Żaneta'])
  assert.equal(decoded.transactions[0].description, 'Żółta łódź')
  assert.equal(decoded.transactions[0].amount, 54.12)
  assert.equal(decoded.participants.find((person) => person.id === decoded.transactions[0].beneficiary).name, 'Żaneta')
})

test('odrzuca nieprawidłowy kod', () => {
  assert.throws(() => decodeTrip('to-nie-jest-kod'), /nieprawidłowy format/)
})
