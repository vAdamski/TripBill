const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function randomCharacters(length, alphabet = ID_ALPHABET) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

export function createId() { return randomCharacters(10) }
export function createParticipantId() { return `p_${randomCharacters(12, ID_ALPHABET.toLowerCase())}` }
export function createTransactionId() { return `t_${randomCharacters(14, ID_ALPHABET.toLowerCase())}` }
