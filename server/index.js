import express from 'express'
import { decodeTrip } from '../src/lib/codec.js'
import { pool, ensureSchema } from './db.js'
import { protectPayload, revealPayload } from './crypto.js'

const app = express()
const port = Number(process.env.PORT || 3000)
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'
const idPattern = /^[A-Z0-9]{10}$/

app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))
app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
  if (request.method === 'OPTIONS') return response.sendStatus(204)
  next()
})

function validPayload(payload) {
  if (typeof payload !== 'string' || payload.length > 750_000) return false
  try { decodeTrip(payload); return true } catch { return false }
}

app.get('/api/health', async (_request, response, next) => {
  try {
    await pool.query('SELECT 1')
    response.json({ status: 'ok' })
  } catch (error) { next(error) }
})

app.post('/api/trips', async (request, response, next) => {
  const id = String(request.body.id || '').toUpperCase()
  const payload = request.body.payload
  const password = String(request.body.password || '')
  if (!idPattern.test(id)) return response.status(400).json({ error: 'Identyfikator musi mieć 10 liter lub cyfr.' })
  if (!validPayload(payload)) return response.status(400).json({ error: 'Dane rozliczenia mają nieprawidłowy format.' })
  try {
    const secured = await protectPayload(payload, password)
    const result = await pool.query(
      `INSERT INTO trip_records (id, payload, encrypted, salt, iv, auth_tag)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING
       RETURNING id, encrypted, created_at, updated_at`,
      [id, secured.payload, secured.encrypted, secured.salt, secured.iv, secured.authTag],
    )
    if (result.rowCount === 0) return response.status(409).json({ error: 'Identyfikator jest już zajęty.' })
    response.status(201).json({ id, protected: secured.encrypted, updated: false })
  } catch (error) { next(error) }
})

app.post('/api/trips/:id/load', async (request, response, next) => {
  const id = String(request.params.id || '').toUpperCase()
  if (!idPattern.test(id)) return response.status(400).json({ error: 'Nieprawidłowy identyfikator.' })
  try {
    const result = await pool.query('SELECT * FROM trip_records WHERE id = $1', [id])
    if (result.rowCount === 0) return response.status(404).json({ error: 'Nie znaleziono rozliczenia.' })
    const record = result.rows[0]
    try {
      const payload = await revealPayload(record, String(request.body.password || ''))
      response.json({ id, payload, protected: record.encrypted, updatedAt: record.updated_at })
    } catch (error) {
      if (error.message === 'PASSWORD_REQUIRED' || error.message === 'INVALID_PASSWORD') {
        return response.status(401).json({ error: 'Hasło jest wymagane lub nieprawidłowe.', passwordRequired: true })
      }
      throw error
    }
  } catch (error) { next(error) }
})

app.put('/api/trips/:id', async (request, response, next) => {
  const id = String(request.params.id || '').toUpperCase()
  const payload = request.body.payload
  const password = String(request.body.password || '')
  if (!idPattern.test(id)) return response.status(400).json({ error: 'Nieprawidłowy identyfikator.' })
  if (!validPayload(payload)) return response.status(400).json({ error: 'Dane rozliczenia mają nieprawidłowy format.' })
  try {
    const existing = await pool.query('SELECT * FROM trip_records WHERE id = $1', [id])
    if (existing.rowCount === 0) return response.status(404).json({ error: 'Nie znaleziono rozliczenia.' })
    const record = existing.rows[0]
    if (record.encrypted) {
      try { await revealPayload(record, password) } catch { return response.status(401).json({ error: 'Nieprawidłowe hasło.', passwordRequired: true }) }
    }
    const secured = await protectPayload(payload, password)
    await pool.query(
      `UPDATE trip_records
       SET payload = $2, encrypted = $3, salt = $4, iv = $5, auth_tag = $6, updated_at = NOW()
       WHERE id = $1`,
      [id, secured.payload, secured.encrypted, secured.salt, secured.iv, secured.authTag],
    )
    response.json({ id, protected: secured.encrypted, updated: true })
  } catch (error) { next(error) }
})

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ error: 'Wewnętrzny błąd serwera.' })
})

await ensureSchema()
const server = app.listen(port, '0.0.0.0', () => console.log(`Trip Bill API listening on ${port}`))

async function shutdown() {
  server.close()
  await pool.end()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
