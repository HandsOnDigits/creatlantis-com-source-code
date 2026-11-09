import argon2 from 'argon2'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const rl = createInterface({ input: stdin, output: stdout })
const password = await rl.question('New admin password: ')
rl.close()

if (password.length < 16) {
  console.error('Use a password of at least 16 characters.')
  process.exit(1)
}

const hash = await argon2.hash(password, {
  type: argon2.argon2id,
})

console.log('\nNew Argon2id hash:\n' + hash)
