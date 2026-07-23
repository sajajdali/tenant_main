import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = [
  "client/src",
  "laravel-app/app",
  "laravel-app/resources/views",
  "laravel-app/routes",
  "laravel-app/config",
];

const ALLOWED_PREFIXES = [
  "client/src/i18n/",
  "client/src/i18n/messages/",
  "client/src/assets/",
  "laravel-app/lang/",
  "docs/",
  "laravel-app/app/Http/Controllers/Admin/",
  "laravel-app/app/OpenApi/",
  "laravel-app/app/Domain/Landing/",
  "laravel-app/app/Http/Controllers/Landing/",
  "laravel-app/app/Services/Landing/",
  "laravel-app/resources/views/admin/",
  "laravel-app/resources/views/vendor/l5-swagger/",
];

const ALLOWED_FILES = new Set([
  "laravel-app/config/localization.php",
  "laravel-app/config/l5-swagger.php",
  "laravel-app/resources/views/auth/admin-login.blade.php",
]);

const SKIP_FILE_PATTERNS = [
  /\.backup-[^/]+\.(ts|tsx|js|jsx|php|blade\.php|json|css)$/,
  /^client\/src\/lib\/mock-articles\.ts$/,
  /^client\/src\/pages\/landing-.*\.tsx$/,
  /^client\/src\/(?:components|lib)\/landing-.*\.(?:ts|tsx)$/,
  /^laravel-app\/app\/Support\/LandingSectionRegistry\.php$/,
];

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "vendor",
  "public",
  "storage",
  "bootstrap/cache",
  "dist",
  "build",
]);

const CHECKS = [
  {
    name: "Persian/Arabic letters outside allowed translation/content paths",
    pattern: /[\u0600-\u06FF]/,
  },
  {
    name: "Fixed RTL direction",
    pattern: /dir=["']rtl["']/,
  },
  {
    name: "Physical alignment or spacing classes",
    pattern: /\b(text-right|text-left|ml-|mr-|pl-|pr-|left-|right-)/,
  },
  {
    name: "Direct locale/calendar/currency formatting hints",
    pattern: /\b(fa-IR|ar-SA|en-US|de-DE|toLocaleString|toLocaleDateString|toLocaleTimeString|USD|SAR|EUR)\b|تومان|ریال/,
  },
  {
    name: "Hardcoded language/country option definitions outside registry/config",
    pattern: /<option[^>\n]+value=["'](?:fa|en|ar|de|IR|SA|DE)["']|(?:locale|country|language)(?:Options|List|Items)?\s*=\s*\[/i,
  },
  {
    name: "Direct React message imports outside index",
    pattern: /from\s+["'][^"']*i18n\/messages\/(fa|en|ar|de)["']/,
  },
];

function isAllowed(filePath) {
  return ALLOWED_FILES.has(filePath) || ALLOWED_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

function shouldSkipFile(filePath) {
  return SKIP_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function shouldSkipDir(filePath) {
  return filePath.split("/").some((part, index, parts) => {
    const partial = parts.slice(Math.max(0, index - 1), index + 1).join("/");
    return SKIP_DIRS.has(part) || SKIP_DIRS.has(partial);
  });
}

function walk(root) {
  const files = [];

  function visit(path) {
    const rel = relative(process.cwd(), path).replaceAll("\\", "/");

    if (shouldSkipDir(rel)) {
      return;
    }

    const stat = statSync(path);

    if (stat.isDirectory()) {
      for (const entry of readdirSync(path)) {
        visit(join(path, entry));
      }
      return;
    }

    if (!/\.(ts|tsx|js|jsx|php|blade\.php|json|css)$/.test(path)) {
      return;
    }

    files.push(rel);
  }

  visit(join(process.cwd(), root));
  return files;
}

const files = ROOTS.flatMap((root) => walk(root)).filter((file) => !isAllowed(file) && !shouldSkipFile(file));
const maxSamples = 12;
let totalMatches = 0;

for (const check of CHECKS) {
  const matches = [];

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (check.pattern.test(line)) {
        matches.push(`${file}:${index + 1}: ${line.trim().slice(0, 180)}`);
      }
    });
  }

  totalMatches += matches.length;
  console.log(`\n${check.name}: ${matches.length}`);

  for (const sample of matches.slice(0, maxSamples)) {
    console.log(`  ${sample}`);
  }

  if (matches.length > maxSamples) {
    console.log(`  ... ${matches.length - maxSamples} more`);
  }
}

console.log(`\nScanned ${files.length} files. Total findings: ${totalMatches}.`);
console.log("This audit is informational while the migration is in progress.");
