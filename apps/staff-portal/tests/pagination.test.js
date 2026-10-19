import assert from "node:assert/strict";
import test from "node:test";
import { compactPagination } from "../src/utils/pagination.js";

test("matches the agreed six-number windows", () => {
  const visible = (page, total = 16) =>
    compactPagination(page, total).map((item) => item.page || "...");
  assert.deepEqual(visible(1), [1, 2, 3, 4, "...", 15, 16]);
  assert.deepEqual(visible(3), [1, 2, 3, 4, "...", 15, 16]);
  assert.deepEqual(visible(8), [1, "...", 7, 8, 9, "...", 15, 16]);
  assert.deepEqual(visible(9), [1, "...", 8, 9, 10, "...", 15, 16]);
  assert.deepEqual(visible(15), [1, "...", 12, 13, 14, 15, 16]);
  assert.deepEqual(visible(3, 6), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(visible(1, 0), [1]);
});

test("every window is ordered, unique, bounded and includes the current page", () => {
  for (let total = 1; total <= 150; total++) {
    for (let current = 1; current <= total; current++) {
      const items = compactPagination(current, total);
      const pages = items
        .filter((item) => item.type === "page")
        .map((item) => item.page);
      assert.ok(pages.length <= 6);
      assert.ok(pages.includes(current));
      assert.equal(pages[0], 1);
      assert.equal(pages.at(-1), total);
      assert.equal(new Set(items.map((item) => item.key)).size, items.length);
      assert.deepEqual(
        pages,
        [...new Set(pages)].sort((a, b) => a - b),
      );
    }
  }
});
