/**
 * Romanian plural: 1 carte · 2–19 cărți · 20+ de cărți.
 * The "de" form after 20 is the part everyone forgets.
 */
export function plural(count: number, one: string, few: string): string {
  if (count === 1) return `o ${one}`;
  const lastTwo = count % 100;
  const needsDe = lastTwo === 0 || lastTwo >= 20;
  return `${count} ${needsDe ? "de " : ""}${few}`;
}
