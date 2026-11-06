// Opens a card from a click anywhere on it, unless the click was on one of its own
// controls (status, star, checkbox, links) or the person was selecting text.
export function openFromCard(event: { target: EventTarget | null }, open: () => void) {
  const target = event.target as HTMLElement | null
  if (target?.closest('button, a, input, select, textarea, label, [role="combobox"], [role="listbox"], [role="option"]')) return
  if (window.getSelection()?.toString()) return
  open()
}

export const clickableCard = 'group cursor-pointer transition-[border-color,box-shadow] hover:border-blue/40 hover:shadow-[0_6px_18px_rgb(0_0_0_/_0.08)]'
