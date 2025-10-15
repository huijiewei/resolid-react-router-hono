import { makeRe } from "minimatch";
import { normalizePath } from "vite";

export const createExcludePatterns = (appDir: string, userExclude?: (string | RegExp)[]): RegExp[] => {
  const appPath = normalizePath(appDir);
  const appRoot = appPath.split("/")[0];

  const patterns: RegExp[] = [
    new RegExp(`^(?=\\/${appPath}\\/)((?!.*\\.data(\\?|$)).*\\..*(\\?.*)?$)`),
    new RegExp(`^(?=\\/${appPath}\\/.*\\/\\..*\\/.*)`),
  ];

  if (appPath != appRoot) {
    patterns.push(new RegExp(`^(?=\\/${appRoot}\\/)((?!.*\\.data(\\?|$)).*\\..*(\\?.*)?$)`));
    patterns.push(new RegExp(`^(?=\\/${appRoot}\\/.*\\/\\..*\\/.*)`));
  }

  if (userExclude) {
    for (const pattern of userExclude) {
      if (pattern instanceof RegExp) {
        patterns.push(pattern);
      } else {
        try {
          patterns.push(makeRe(pattern) as RegExp);
        } catch {
          // do nothing
        }
      }
    }
  }

  return patterns;
};

export const shouldExcludeUrl = (url: string, patterns: RegExp[]): boolean => {
  if (url.includes("/node_modules/") || url.startsWith("/@") || url.includes("?import")) {
    return true;
  }

  for (const pattern of patterns) {
    if (pattern.test(url)) {
      return true;
    }
  }

  return false;
};
