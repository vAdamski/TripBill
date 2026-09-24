const toCents = (amount) => Math.round(Number(amount) * 100)

export function calculateSettlement(participants, transactions) {
  const rows = new Map(participants.map((person) => [person.id, { id: person.id, name: person.name, paid: 0, owed: 0, balance: 0 }]))
  let total = 0
  let commonTotal = 0
  const invalidTransactions = []
  for (const transaction of transactions) {
    const cents = toCents(transaction.amount)
    const payer = rows.get(transaction.paidBy)
    if (!payer || !Number.isSafeInteger(cents) || cents <= 0) { invalidTransactions.push(transaction.id); continue }
    if (transaction.split === 'person') {
      const beneficiary = rows.get(transaction.beneficiary)
      if (!beneficiary) { invalidTransactions.push(transaction.id); continue }
      beneficiary.owed += cents
    } else {
      if (participants.length === 0) { invalidTransactions.push(transaction.id); continue }
      commonTotal += cents
      const baseShare = Math.floor(cents / participants.length)
      let remainder = cents - baseShare * participants.length
      for (const person of participants) {
        rows.get(person.id).owed += baseShare + (remainder > 0 ? 1 : 0)
        remainder -= remainder > 0 ? 1 : 0
      }
    }
    payer.paid += cents
    total += cents
  }
  const balances = participants.map((person) => { const row = rows.get(person.id); row.balance = row.paid - row.owed; return row })
  const debtors = balances.filter((row) => row.balance < 0).map((row) => ({ ...row, remaining: -row.balance }))
  const creditors = balances.filter((row) => row.balance > 0).map((row) => ({ ...row, remaining: row.balance }))
  const transfers = []
  let debtorIndex = 0
  let creditorIndex = 0
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]
    const creditor = creditors[creditorIndex]
    const amount = Math.min(debtor.remaining, creditor.remaining)
    if (amount > 0) transfers.push({ fromId: debtor.id, from: debtor.name, toId: creditor.id, to: creditor.name, amount })
    debtor.remaining -= amount
    creditor.remaining -= amount
    if (debtor.remaining === 0) debtorIndex += 1
    if (creditor.remaining === 0) creditorIndex += 1
  }
  return { total, commonTotal, averageCommon: participants.length ? Math.round(commonTotal / participants.length) : 0, expenseCount: transactions.length - invalidTransactions.length, balances, transfers, invalidTransactions }
}

export function formatMoney(amount) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 }).format(Number(amount) || 0)
}
