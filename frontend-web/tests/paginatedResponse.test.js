import test from "node:test";
import assert from "node:assert/strict";

import { PaginatedResponseError, paginateItems, parsePaginatedResponse } from "../src/api/paginatedResponse.js";

function page(overrides = {}) {
  return {
    content: [{ id: 1 }], number: 0, size: 10,
    totalElements: 21, totalPages: 3, first: true, last: false,
    ...overrides
  };
}

test("parses a valid Spring Page and preserves metadata", () => {
  const result = parsePaginatedResponse(page(), "classes");
  assert.deepEqual(result.content, [{ id: 1 }]);
  assert.equal(result.page, 0);
  assert.equal(result.size, 10);
  assert.equal(result.totalElements, 21);
  assert.equal(result.totalPages, 3);
  assert.equal(result.hasNext, true);
});

test("accepts a valid empty page", () => {
  const result = parsePaginatedResponse(page({ content: [], totalElements: 0, totalPages: 0, last: true }), "classes");
  assert.deepEqual(result.content, []);
  assert.equal(result.totalElements, 0);
  assert.equal(result.hasNext, false);
});

test("normalizes first and second page numbers without losing content", () => {
  const first = parsePaginatedResponse(page({ number: 0 }), "classes");
  const second = parsePaginatedResponse(page({ number: 1, content: [{ id: 11 }] }), "classes");
  assert.equal(first.page, 0);
  assert.equal(second.page, 1);
  assert.deepEqual(second.content, [{ id: 11 }]);
});

test("supports totalElements larger than page size", () => {
  const result = parsePaginatedResponse(page({ size: 20, totalElements: 101, totalPages: 6 }), "classes");
  assert.equal(result.size, 20);
  assert.equal(result.totalElements, 101);
  assert.equal(result.totalPages, 6);
});

test("rejects an old array response instead of hiding it as an empty page", () => {
  assert.throws(() => parsePaginatedResponse([], "classes"), PaginatedResponseError);
});

test("rejects malformed successful responses", () => {
  assert.throws(() => parsePaginatedResponse({ content: {} }, "classes"), /content phải là array/);
  assert.throws(() => parsePaginatedResponse({ content: [], number: 0 }, "classes"), /size/);
});

test("paginates a merged report into stable first and second pages", () => {
  const items = Array.from({ length: 25 }, (_, index) => ({ id: index + 1 }));
  assert.deepEqual(paginateItems(items, 0, 10).map((item) => item.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(paginateItems(items, 1, 10).map((item) => item.id), [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  assert.deepEqual(paginateItems(items, 2, 10).map((item) => item.id), [21, 22, 23, 24, 25]);
});
