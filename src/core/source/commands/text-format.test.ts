import { describe, expect, it } from "vitest";
import { shortenText } from "./text-format.js";

describe("shortenText", () => {
  it("returns original text when it fits", () => {
    expect(shortenText("must-b", 16)).toBe("must-b");
  });

  it("truncates and appends ellipsis when over limit", () => {
    expect(shortenText("must-b-status-output", 10)).toBe("must-b-…");
  });

  it("counts multi-byte characters correctly", () => {
    expect(shortenText("hello🙂world", 7)).toBe("hello🙂…");
  });
});
