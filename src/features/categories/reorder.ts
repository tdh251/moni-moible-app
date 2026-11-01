export const CATEGORY_ROW_GAP = 8;
export interface CategoryRowLayout {
  id: string;
  top: number;
  height: number;
}

export function categoryDropPosition(
  rows: CategoryRowLayout[],
  id: string,
  delta: number,
) {
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0 || !Number.isFinite(delta)) return null;
  const row = rows[index];
  const last = rows[rows.length - 1];
  const translation = Math.max(
    rows[0].top - row.top,
    Math.min(last.top + last.height - row.height - row.top, delta),
  );
  const center = row.top + row.height / 2 + translation;
  let target = index;
  if (translation > 0) {
    for (let i = index + 1; i < rows.length && center > rows[i].top; i++)
      target = i;
  } else if (translation < 0) {
    for (
      let i = index - 1;
      i >= 0 && center < rows[i].top + rows[i].height;
      i--
    )
      target = i;
  }
  return { index, target, translation, extent: row.height + CATEGORY_ROW_GAP };
}

export function reorderCategoryIds(
  ids: string[],
  from: number,
  to: number,
): string[] {
  const result = [...ids];
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= ids.length ||
    to >= ids.length ||
    from === to
  )
    return result;
  const [id] = result.splice(from, 1);
  result.splice(to, 0, id);
  return result;
}
