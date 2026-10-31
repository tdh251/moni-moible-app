import type { Category } from '../../types/finance.ts';

export function categoryPath(
  categories: Category[],
  id: string | null,
): string {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const names: string[] = [];
  const seen = new Set<string>();
  let current = id ? byId.get(id) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.push(current.name);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return names.reverse().join(' › ');
}

export function categoryDescendants(
  categories: Category[],
  ids: string[],
): Set<string> {
  const children = new Map<string, string[]>();
  for (const c of categories) {
    if (c.parent_id) {
      const group = children.get(c.parent_id);
      if (group) group.push(c.id);
      else children.set(c.parent_id, [c.id]);
    }
  }
  const result = new Set<string>();
  const pending = [...ids];
  while (pending.length) {
    const id = pending.pop()!;
    if (result.has(id)) continue;
    result.add(id);
    pending.push(...(children.get(id) ?? []));
  }
  return result;
}

export function categoryTree(
  categories: Category[],
  collapsed: ReadonlySet<string> = new Set(),
): { category: Category; depth: number }[] {
  const ids = new Set(categories.map((c) => c.id));
  const children = new Map<string | null, Category[]>();
  for (const c of [...categories].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
  )) {
    const parent = c.parent_id && ids.has(c.parent_id) ? c.parent_id : null;
    const group = children.get(parent);
    if (group) group.push(c);
    else children.set(parent, [c]);
  }
  const result: { category: Category; depth: number }[] = [];
  const pending = (children.get(null) ?? [])
    .map((category) => ({ category, depth: 0 }))
    .reverse();
  const seen = new Set<string>();
  while (pending.length) {
    const row = pending.pop()!;
    if (seen.has(row.category.id)) continue;
    seen.add(row.category.id);
    result.push(row);
    if (collapsed.has(row.category.id)) continue;
    const descendants = children.get(row.category.id) ?? [];
    for (let i = descendants.length - 1; i >= 0; i--)
      pending.push({ category: descendants[i], depth: row.depth + 1 });
  }
  return result;
}

export function categoryHierarchyError(categories: Category[]): string | null {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const done = new Set<string>();
  for (const c of categories) {
    const path = new Set<string>();
    let current: Category | undefined = c;
    while (current && !done.has(current.id)) {
      if (path.has(current.id))
        return 'Danh mục cha không được là chính nó hoặc danh mục con của nó.';
      path.add(current.id);
      if (current.parent_id != null) {
        const parent: Category | undefined = byId.get(current.parent_id);
        if (!parent || parent.type !== current.type)
          return 'Danh mục cha phải tồn tại và cùng loại thu hoặc chi.';
        if (!current.is_archived && parent.is_archived)
          return 'Hãy khôi phục danh mục cha trước.';
        current = parent;
      } else current = undefined;
    }
    for (const id of path) done.add(id);
  }
  return null;
}
