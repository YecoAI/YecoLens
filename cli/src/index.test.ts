import { describe, it, expect } from "vitest";
import { parseArgs } from "./index.js";

describe("cli arg parsing", () => {
  it("defaults to opening the browser on no args", () => {
    expect(parseArgs([])).toEqual({ noBrowser: false, port: undefined });
  });
  it("respects --no-browser", () => {
    expect(parseArgs(["--no-browser"])).toEqual({ noBrowser: true, port: undefined });
  });
  it("respects -n shorthand", () => {
    expect(parseArgs(["-n"])).toEqual({ noBrowser: true, port: undefined });
  });
  it("parses --port=N", () => {
    expect(parseArgs(["--port=8080"])).toEqual({ noBrowser: false, port: 8080 });
  });
  it("combines flags", () => {
    expect(parseArgs(["--no-browser", "--port=3000"])).toEqual({ noBrowser: true, port: 3000 });
  });
});
