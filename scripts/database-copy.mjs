import { copyDatabase } from '../server/database-backup.mjs'
const [source, destination] = process.argv.slice(2)
if (!source || !destination) { console.error('Usage: npm run db:backup -- SOURCE.sqlite NEW-DESTINATION.sqlite (also used for restore to a new file)'); process.exitCode = 1 }
else { try { console.log(`Verified database copy saved to ${await copyDatabase(source, destination)}`) } catch (error) { console.error(error.message); process.exitCode = 1 } }
