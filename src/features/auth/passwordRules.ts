// Password rules shared by the sign-up form and the server.
// The server is the one that enforces them; the form only shows progress.

export type PasswordRule = 'length' | 'lower' | 'upper' | 'numberOrSymbol' | 'notCommon' | 'notPersonal'

export const passwordRuleLabels: Record<PasswordRule, string> = {
  length: '15–128 characters',
  lower: 'A lowercase letter',
  upper: 'An uppercase letter',
  numberOrSymbol: 'A number or symbol',
  notCommon: 'Not a common or repeated pattern',
  notPersonal: "Doesn't include your name or email",
}

// Words people base weak passwords on. Checked after removing numbers and symbols,
// so "Password123!!!!!!" counts as "password".
const commonWords = new Set([
  'password', 'passw', 'pass', 'passwordpassword', 'qwerty', 'qwertyuiop', 'asdfgh', 'asdfghjkl', 'zxcvbnm',
  'letmein', 'welcome', 'welcomeback', 'admin', 'administrator', 'iloveyou', 'loveyou', 'monkey', 'dragon',
  'football', 'baseball', 'basketball', 'sunshine', 'princess', 'starwars', 'superman', 'batman', 'master',
  'shadow', 'trustno', 'whatever', 'freedom', 'abc', 'abcdef', 'abcdefg', 'abcdefgh', 'changeme', 'secret',
  'hello', 'helloworld', 'login', 'default', 'petalpace', 'student', 'school', 'philippines', 'manila',
])

const sequences = ['abcdefghijklmnopqrstuvwxyz', '01234567890', 'qwertyuiopasdfghjklzxcvbnm']

function isPattern(lower: string) {
  if (/^(.{1,5})\1+.{0,5}$/.test(lower)) return true // aaaa…, abcabc…, 1212…
  if (new Set(lower).size <= 4) return true // only a handful of different characters
  for (const run of sequences) {
    for (let i = 0; i + 8 <= run.length; i++) if (lower.includes(run.slice(i, i + 8))) return true
  }
  return false
}

export function passwordProblems(password: string, person: { email?: string; name?: string } = {}): PasswordRule[] {
  const problems: PasswordRule[] = []
  const length = [...password].length
  const lower = password.toLowerCase()
  if (length < 15 || length > 128) problems.push('length')
  if (!/\p{Ll}/u.test(password)) problems.push('lower')
  if (!/\p{Lu}/u.test(password)) problems.push('upper')
  if (!/[\p{N}\p{P}\p{S}]/u.test(password)) problems.push('numberOrSymbol')
  const letters = lower.replace(/[^\p{L}]/gu, '')
  if (!password || commonWords.has(letters) || letters.length < 4 || isPattern(lower)) problems.push('notCommon')
  const parts = [
    ...(person.email?.toLowerCase().split('@')[0].split(/[^\p{L}\p{N}]+/u) ?? []),
    ...(person.name?.toLowerCase().split(/\s+/) ?? []),
  ].filter(part => part.length >= 4)
  if (parts.some(part => lower.includes(part))) problems.push('notPersonal')
  return problems
}

export function passwordError(problems: PasswordRule[]) {
  if (!problems.length) return ''
  if (problems.includes('length')) return 'Use a password with 15–128 characters.'
  if (problems.some(p => p === 'lower' || p === 'upper' || p === 'numberOrSymbol')) return 'Use uppercase and lowercase letters, plus at least one number or symbol.'
  if (problems.includes('notPersonal')) return "Your password can't include your name or email."
  return 'This password is too easy to guess. Try a few random words with a number or symbol.'
}
