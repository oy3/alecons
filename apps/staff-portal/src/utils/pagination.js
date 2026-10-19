export function compactPagination(currentPage, totalPages) {
  const total = Math.max(1, Math.trunc(totalPages));
  const current = Math.min(total, Math.max(1, Math.trunc(currentPage)));
  let pages;

  if (total <= 6) {
    pages = Array.from({ length: total }, (_, index) => index + 1);
  } else if (current <= 3) {
    pages = [1, 2, 3, 4, total - 1, total];
  } else if (current >= total - 2) {
    pages = [1, total - 4, total - 3, total - 2, total - 1, total];
  } else {
    pages = [1, current - 1, current, current + 1, total - 1, total];
  }

  return pages.flatMap((page, index) => {
    const item = { type: "page", page, key: `page-${page}` };
    return index > 0 && page - pages[index - 1] > 1
      ? [{ type: "ellipsis", key: `gap-${page}` }, item]
      : [item];
  });
}
