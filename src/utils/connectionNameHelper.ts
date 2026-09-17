/**
 * Generates an available duplicate connection name based on the original name.
 *
 * Examples:
 * - "Local MSSQL" -> "Local MSSQL (Copy)"
 * - If "Local MSSQL (Copy)" exists -> "Local MSSQL (Copy 2)"
 * - If "Local MSSQL (Copy 2)" exists -> "Local MSSQL (Copy 3)"
 * - If "Local MSSQL (Copy)" is passed as baseName -> "Local MSSQL (Copy 2)"
 *
 * @param baseName The original connection profile name.
 * @param existingNames The list of currently existing connection names.
 */
export function generateDuplicateConnectionName(
  baseName: string,
  existingNames: string[] = []
): string {
  const trimmedBase = (baseName || '').trim() || 'New Connection';
  const existingSet = new Set(
    existingNames.map((n) => n.trim().toLowerCase())
  );

  // Check if baseName already ends with ` (Copy)` or ` (Copy \d+)`
  const copyPattern = /^(.*) \(Copy(?: (\d+))?\)$/i;
  const match = trimmedBase.match(copyPattern);
  const rootName = (match && match[1] ? match[1].trim() : '') || trimmedBase;

  // First candidate: "RootName (Copy)"
  let candidate = `${rootName} (Copy)`;
  if (!existingSet.has(candidate.toLowerCase())) {
    return candidate;
  }

  // Next candidates: "RootName (Copy 2)", "RootName (Copy 3)", etc.
  let counter = 2;
  while (true) {
    candidate = `${rootName} (Copy ${counter})`;
    if (!existingSet.has(candidate.toLowerCase())) {
      return candidate;
    }
    counter++;
  }
}
