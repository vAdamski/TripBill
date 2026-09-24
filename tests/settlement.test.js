import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateSettlement } from '../src/lib/settlement.js'

const people = [
  { id: 'adam', name: 'Adam' },
  { id: 'damian', name: 'Damian' },
  { id: 'ola', name: 'Ola' },
]

test('dzieli koszty wspólne i dolicza koszty indywidualne', () => {
  const result = calculateSettlement(people, [
    { id: '1', paidBy: 'adam', amount: 300, split: 'all' },
    { id: '2', paidBy: 'adam', amount: 54, split: 'person', beneficiary: 'damian' },
    { id: '3', paidBy: 'adam', amount: 90, split: 'person', beneficiary: 'ola' },
  ])
  assert.equal(result.total, 44_400)
  assert.deepEqual(result.balances.map(({ name, balance }) => [name, balance]), [
    ['Adam', 34_400], ['Damian', -15_400], ['Ola', -19_000],
  ])
  assert.deepEqual(result.transfers.map(({ from, to, amount }) => [from, to, amount]), [
    ['Damian', 'Adam', 15_400], ['Ola', 'Adam', 19_000],
  ])
})

test('rozdziela resztę groszową bez utraty kwoty', () => {
  const result = calculateSettlement(people, [{ id: '1', paidBy: 'adam', amount: 100, split: 'all' }])
  assert.deepEqual(result.balances.map(({ owed }) => owed), [3334, 3333, 3333])
  assert.equal(result.balances.reduce((sum, row) => sum + row.balance, 0), 0)
})
