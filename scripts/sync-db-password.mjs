import { execFileSync } from 'node:child_process'

function output(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim()
}

const containerId = output('docker', ['compose', 'ps', '-q', 'db'])
if (!containerId) {
  throw new Error('Kontener bazy nie działa. Uruchom najpierw: docker compose up -d db')
}

const environment = output('docker', [
  'inspect',
  '--format',
  '{{range .Config.Env}}{{println .}}{{end}}',
  containerId,
]).split('\n')

const readVariable = (name) => environment
  .find((line) => line.startsWith(`${name}=`))
  ?.slice(name.length + 1)

const user = readVariable('POSTGRES_USER')
const database = readVariable('POSTGRES_DB')
const password = readVariable('POSTGRES_PASSWORD')

if (!user || !database || !password) {
  throw new Error('Kontener bazy nie zawiera wymaganych zmiennych PostgreSQL.')
}

const quotedUser = `"${user.replaceAll('"', '""')}"`
const quotedPassword = `'${password.replaceAll("'", "''")}'`

execFileSync('docker', [
  'exec',
  containerId,
  'psql',
  '-v',
  'ON_ERROR_STOP=1',
  '-U',
  user,
  '-d',
  database,
  '-c',
  `ALTER ROLE ${quotedUser} PASSWORD ${quotedPassword};`,
], { stdio: 'inherit' })

console.log('Hasło roli PostgreSQL jest zgodne z konfiguracją Docker Compose.')
