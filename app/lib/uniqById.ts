export function uniqById(matches: any[]) {
  const seen = new Set<string>();
  return matches.filter((m) => {
    const id = String(m._id ?? m.id);
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}
