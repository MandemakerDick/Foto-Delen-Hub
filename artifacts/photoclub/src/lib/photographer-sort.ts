// Profile names are stored as a single display name. The final word is the
// surname for the usual "first name [lowercase infix] surname" format.
// Keep this rule consistent with the future native Photographers directory.
const nameCollator = new Intl.Collator("nl", { sensitivity: "accent" });

export function surnameSortKey(name: string): string {
  return name.trim().split(/\s+/).at(-1) ?? "";
}

export function sortPhotographersBySurname<T extends { id: number; name: string }>(
  photographers: readonly T[],
): T[] {
  return [...photographers].sort((a, b) => {
    const surnameOrder = nameCollator.compare(surnameSortKey(a.name), surnameSortKey(b.name));
    if (surnameOrder !== 0) return surnameOrder;

    const fullNameOrder = nameCollator.compare(a.name.trim(), b.name.trim());
    if (fullNameOrder !== 0) return fullNameOrder;
    return a.id - b.id;
  });
}