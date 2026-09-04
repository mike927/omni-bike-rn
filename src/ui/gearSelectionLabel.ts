/** Selection is separate from device readiness on every gear card. */
export function gearSelectionLabel(kind: string, selected?: boolean): string {
  if (selected === undefined) return kind;
  return `${kind} · ${selected ? 'Selected' : 'Not selected'}`;
}
