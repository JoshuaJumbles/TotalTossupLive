const ORDINAL_WORDS = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
  'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen',
]

export function ordinalWord(n: number): string {
  return ORDINAL_WORDS[n] ?? String(n)
}
