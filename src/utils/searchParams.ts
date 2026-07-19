export function parseEnumParam<T extends string>(
  raw: string | null,
  validValues: readonly T[],
  fallback: T,
): T {
  return (validValues as readonly string[]).includes(raw ?? '') ? (raw as T) : fallback
}
