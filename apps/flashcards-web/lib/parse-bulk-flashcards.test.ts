import { describe, it, expect } from "vitest";
import { parseBulkFlashcards } from "./parse-bulk-flashcards";

describe("parseBulkFlashcards", () => {
  it("returns an empty result for empty input", () => {
    const result = parseBulkFlashcards("");
    expect(result.rows).toHaveLength(0);
    expect(result.validCount).toBe(0);
    expect(result.headerSkipped).toBe(false);
  });

  it("returns an empty result for whitespace-only input", () => {
    const result = parseBulkFlashcards("   \n   \n\t\n");
    expect(result.rows).toHaveLength(0);
  });

  it("parses one valid TAB-separated row", () => {
    const result = parseBulkFlashcards("hello\txin chào");
    expect(result.rows).toEqual([{ index: 1, front: "hello", back: "xin chào", status: "valid" }]);
    expect(result.validCount).toBe(1);
  });

  it("parses multiple valid rows, preserving order", () => {
    const result = parseBulkFlashcards("hello\txin chào\nworld\tthế giới\nbook\tquyển sách");
    expect(result.rows.map((r) => r.front)).toEqual(["hello", "world", "book"]);
    expect(result.validCount).toBe(3);
  });

  it("trims surrounding whitespace from both fields", () => {
    const result = parseBulkFlashcards("  hello  \t  xin chào  ");
    expect(result.rows[0]).toMatchObject({ front: "hello", back: "xin chào", status: "valid" });
  });

  it("preserves meaningful internal whitespace within a field", () => {
    const result = parseBulkFlashcards("well known\tnổi tiếng");
    expect(result.rows[0]).toMatchObject({ front: "well known", back: "nổi tiếng", status: "valid" });
  });

  it("marks a row with no separator at all as invalid", () => {
    const result = parseBulkFlashcards("hello");
    expect(result.rows[0].status).toBe("invalid");
  });

  it("does not fall back to splitting on spaces when there is no TAB — avoids guessing the column boundary", () => {
    const result = parseBulkFlashcards("hello world xin chào");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].status).toBe("invalid");
  });

  it("marks a row with more than 2 TAB-separated columns as invalid, without silently merging or truncating", () => {
    const result = parseBulkFlashcards("hello\txin chào\textra");
    expect(result.rows[0].status).toBe("invalid");
  });

  it("marks a row with an empty Back field as invalid", () => {
    const result = parseBulkFlashcards("hello\t");
    expect(result.rows[0].status).toBe("invalid");
  });

  it("marks a row with an empty Front field as invalid", () => {
    const result = parseBulkFlashcards("\txin chào");
    expect(result.rows[0].status).toBe("invalid");
  });

  it("ignores completely empty (blank) lines rather than treating them as rows", () => {
    const result = parseBulkFlashcards("hello\txin chào\n\n\nworld\tthế giới");
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((r) => r.front)).toEqual(["hello", "world"]);
  });

  it('treats "hello" on its own line followed by "xin chào" on the next as two separate invalid rows, never merged into one card', () => {
    const result = parseBulkFlashcards("hello\n\nxin chào");
    expect(result.rows).toHaveLength(2);
    expect(result.rows.every((r) => r.status === "invalid")).toBe(true);
  });

  describe("header handling", () => {
    it('skips a first row that is exactly "Front" / "Back" (case-insensitive)', () => {
      const result = parseBulkFlashcards("Front\tBack\nhello\txin chào");
      expect(result.headerSkipped).toBe(true);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({ front: "hello", index: 1 });
    });

    it('skips a first row that is exactly "Mặt trước" / "Mặt sau" (case-insensitive)', () => {
      const result = parseBulkFlashcards("mặt trước\tmặt sau\nhello\txin chào");
      expect(result.headerSkipped).toBe(true);
      expect(result.rows).toHaveLength(1);
    });

    it("does not skip a first row that merely resembles a header but isn't an exact recognized pair", () => {
      const result = parseBulkFlashcards("Word\tMeaning\nhello\txin chào");
      expect(result.headerSkipped).toBe(false);
      expect(result.rows).toHaveLength(2);
    });

    it("does not skip a first row that happens to be real vocabulary data", () => {
      const result = parseBulkFlashcards("hello\txin chào\nworld\tthế giới");
      expect(result.headerSkipped).toBe(false);
      expect(result.rows).toHaveLength(2);
    });
  });

  describe("duplicate detection", () => {
    it("marks a later exact repeat within the same pasted batch as a duplicate, not invalid", () => {
      const result = parseBulkFlashcards("hello\txin chào\nworld\tthế giới\nhello\txin chào");
      expect(result.rows.map((r) => r.status)).toEqual(["valid", "valid", "duplicate"]);
      expect(result.duplicateCount).toBe(1);
    });

    it("treats duplicates as trimmed and exact-match — trailing whitespace differences still count as the same pair", () => {
      const result = parseBulkFlashcards("hello\txin chào\n  hello  \t  xin chào  ");
      expect(result.rows[1].status).toBe("duplicate");
    });

    it("flags a row as a duplicate of an already-existing card in the set", () => {
      const result = parseBulkFlashcards("hello\txin chào", [{ front: "hello", back: "xin chào" }]);
      expect(result.rows[0].status).toBe("duplicate");
      expect(result.duplicateCount).toBe(1);
    });

    it("does not confuse front='a b'+back='c' with front='a'+back='b c'", () => {
      const result = parseBulkFlashcards("a b\tc\na\tb c");
      expect(result.rows.every((r) => r.status === "valid")).toBe(true);
    });
  });

  it("handles a large valid input efficiently and correctly", () => {
    const lines = Array.from({ length: 500 }, (_, i) => `word${i}\tmeaning${i}`).join("\n");
    const result = parseBulkFlashcards(lines);
    expect(result.rows).toHaveLength(500);
    expect(result.validCount).toBe(500);
    expect(result.rows[499]).toMatchObject({ index: 500, front: "word499", back: "meaning499", status: "valid" });
  });

  it("reports a correct mixed summary (valid + duplicate + invalid) matching the totals the UI shows", () => {
    const input = [
      "hello\txin chào", // valid
      "world\tthế giới", // valid
      "hello\txin chào", // duplicate of row 1
      "book", // invalid — no separator
      "\tquyển sách", // invalid — empty front
    ].join("\n");

    const result = parseBulkFlashcards(input);
    expect(result.rows).toHaveLength(5);
    expect(result.validCount).toBe(2);
    expect(result.duplicateCount).toBe(1);
    expect(result.invalidCount).toBe(2);
  });
});
