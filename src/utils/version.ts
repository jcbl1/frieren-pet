function parseVersion(version: string): number[] {
  return version
    .split(/[^0-9]/)
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part))
}

export function isVersionNewer(candidate: string, current: string): boolean {
  const candidateParts = parseVersion(candidate)
  const currentParts = parseVersion(current)

  for (let index = 0; index < Math.min(candidateParts.length, currentParts.length); index += 1) {
    if (candidateParts[index] !== currentParts[index]) {
      return candidateParts[index] > currentParts[index]
    }
  }

  return candidateParts.length > currentParts.length
}
