import { promisify } from 'node:util'
import { createCipheriv, createDecipheriv, randomBytes, scrypt as scryptCallback } from 'node:crypto'

const scrypt = promisify(scryptCallback)

async function deriveKey(password, salt) {
  return scrypt(password, salt, 32)
}

export async function protectPayload(payload, password = '') {
  if (!password) {
    return { payload, encrypted: false, salt: null, iv: null, authTag: null }
  }
  if (password.length > 200) throw new Error('Hasło jest zbyt długie.')
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = await deriveKey(password, salt)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()])
  return {
    payload: encrypted.toString('base64url'),
    encrypted: true,
    salt: salt.toString('base64url'),
    iv: iv.toString('base64url'),
    authTag: cipher.getAuthTag().toString('base64url'),
  }
}

export async function revealPayload(record, password = '') {
  if (!record.encrypted) return record.payload
  if (!password) throw new Error('PASSWORD_REQUIRED')
  try {
    const key = await deriveKey(password, Buffer.from(record.salt, 'base64url'))
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(record.iv, 'base64url'))
    decipher.setAuthTag(Buffer.from(record.auth_tag ?? record.authTag, 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(record.payload, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    throw new Error('INVALID_PASSWORD')
  }
}
