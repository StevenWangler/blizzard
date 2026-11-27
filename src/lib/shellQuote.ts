/** Quote one argument for the POSIX shells used by the copied gh commands. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}
