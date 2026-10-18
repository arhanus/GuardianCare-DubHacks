/** A replayed bracelet event must not repeatedly restart the recipient's alarm. */
export function rememberSOS(seen: Set<string>, id: string): boolean {
  if (!id.trim() || id.length > 128 || seen.has(id)) return false;
  seen.add(id);
  if (seen.size > 100) seen.delete(seen.values().next().value!);
  return true;
}
