import test from 'node:test'
import assert from 'node:assert/strict'
import { protectPayload, revealPayload } from '../server/crypto.js'

test('szyfruje dane hasłem i odszyfrowuje tylko poprawnym hasłem', async () => {
  const secured = await protectPayload('tajne-dane', 'mocne-hasło')
  assert.equal(secured.encrypted, true)
  assert.notEqual(secured.payload, 'tajne-dane')
  assert.equal(await revealPayload({ ...secured, auth_tag: secured.authTag }, 'mocne-hasło'), 'tajne-dane')
  await assert.rejects(() => revealPayload({ ...secured, auth_tag: secured.authTag }, 'złe-hasło'), /INVALID_PASSWORD/)
})
