import { beforeEach, describe, expect, it } from "vitest";
import { createExcludePatterns, shouldExcludeUrl } from "./utils";

describe("shouldExcludeUrl", () => {
  let patterns: RegExp[];

  beforeEach(() => {
    patterns = createExcludePatterns("src/app");
  });

  it("should exclude node_modules paths", () => {
    expect(shouldExcludeUrl("/node_modules/react/index.js", patterns)).toBe(true);
    expect(shouldExcludeUrl("/src/node_modules/lodash/index.js", patterns)).toBe(true);
  });

  it("should exclude virtual modules starting with @", () => {
    expect(shouldExcludeUrl("/@alias/file.js", patterns)).toBe(true);
    expect(shouldExcludeUrl("/@hooks/useCustom", patterns)).toBe(true);
  });

  it("should exclude URLs with ?import query parameter", () => {
    expect(shouldExcludeUrl("/src/app/page.js?import", patterns)).toBe(true);
    expect(shouldExcludeUrl("/src/app/page.jsx?import&foo=bar", patterns)).toBe(true);
  });

  it("should exclude files under appDir with extensions", () => {
    expect(shouldExcludeUrl("/src/app/page.js", patterns)).toBe(true);
    expect(shouldExcludeUrl("/src/app/component.jsx", patterns)).toBe(true);
    expect(shouldExcludeUrl("/src/app/server.ts", patterns)).toBe(true);
    expect(shouldExcludeUrl("/src/app/nested/deep/component.tsx", patterns)).toBe(true);
    expect(shouldExcludeUrl("/src/app/page.data.js", patterns)).toBe(true);
    expect(shouldExcludeUrl("/src/app/config.json", patterns)).toBe(true);
  });

  it("should exclude files outside appDir", () => {
    expect(shouldExcludeUrl("/src/other/page.js", patterns)).toBe(true);
  });

  it("should not exclude files without extensions", () => {
    expect(shouldExcludeUrl("/src/app/page", patterns)).toBe(false);
  });

  it("should exclude hidden files and directories under appDir", () => {
    expect(shouldExcludeUrl("/src/app/.hidden/file.js", patterns)).toBe(true);
    expect(shouldExcludeUrl("/src/app/.env", patterns)).toBe(true);
    expect(shouldExcludeUrl("/src/app/config/.secret/data.json", patterns)).toBe(true);
  });

  it("should exclude hidden files under appRoot", () => {
    expect(shouldExcludeUrl("/src/.hidden/file.js", patterns)).toBe(true);
    expect(shouldExcludeUrl("/src/.git/config", patterns)).toBe(true);
  });

  it("should match user-provided patterns", () => {
    const customPatterns = createExcludePatterns("src", [/^\/admin\/.*/]);
    expect(shouldExcludeUrl("/admin/dashboard", customPatterns)).toBe(true);
  });

  it("should not exclude normal route paths", () => {
    expect(shouldExcludeUrl("/src/app/about", patterns)).toBe(false);
    expect(shouldExcludeUrl("/src/app/user/profile", patterns)).toBe(false);
  });

  it("should handle query parameters correctly", () => {
    expect(shouldExcludeUrl("/src/app/page.js?v=1", patterns)).toBe(true);
    expect(shouldExcludeUrl("/src/app/page.data?foo=bar", patterns)).toBe(false);
  });
});
