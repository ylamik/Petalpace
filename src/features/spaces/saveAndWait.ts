// Apply a planner change, then wait for the server to confirm it, so buttons can show "Saving…".
// The short pause lets React render the change so the provider queues it before we wait.
export async function saveAndWait(apply: () => void, ensureSaved: () => Promise<boolean>) {
  apply()
  await new Promise(resolve => setTimeout(resolve, 80))
  return ensureSaved()
}
