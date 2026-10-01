/**
 * Static sanity check over the migration SQL. Run outside the app.
 *
 *   node scripts/check-migrations.js
 *
 * There is no Postgres in this environment, so this cannot prove the schema is
 * valid. What it does catch is the class of mistake that is easy to make and
 * invisible until a cold start: a regex quantifier accidentally read as
 * JavaScript interpolation, a stray `${` left in a template literal, or a
 * placeholder numbering gap.
 */

import { readFileSync } from "node:fs";

const { migrations } = await import("../lib/db.js");

let problems = 0;

function fail(message) {
  problems += 1;
  console.error(`  FAIL  ${message}`);
}

/*
 * The escaping check runs against the source, not the loaded strings. At
 * runtime every regex quantifier is supposed to read "{2,8}"; only the source
 * can distinguish a correctly written literal from one that JavaScript
 * interpolated into "undefined" before the string ever reached this script.
 *
 * Only the migrations literal is scanned, and JS line comments are stripped
 * first. Elsewhere in the file an interpolation is exactly what should happen,
 * such as logging a migration name, and a comment explaining a past escaping
 * mistake is not itself a bug. SQL comments in the migration use "--", not "//",
 * so this does not touch them.
 */
const source = readFileSync(new URL("../lib/db.js", import.meta.url), "utf8");
const start = source.indexOf("const migrations = [");
const end = source.indexOf("\n];", start);
const sqlRegion =
  start === -1 || end === -1
    ? ""
    : source
        .slice(start, end)
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
const interpolations = [...sqlRegion.matchAll(/(?<!\\)\$\{/g)];

console.log("lib/db.js migration SQL");
if (start === -1 || end === -1) {
  fail("could not locate the migrations literal in lib/db.js");
} else if (interpolations.length) {
  fail(
    `${interpolations.length} unescaped "\${" in the SQL: these interpolate at runtime. ` +
      "Escape them as \\${ if the SQL is meant to contain a literal $.",
  );
} else {
  console.log('  ok    every "${" in the SQL is escaped');
}

for (const migration of migrations) {
  console.log(`\n${migration.name}`);

  if (!Array.isArray(migration.statements) || migration.statements.length === 0) {
    fail("statements must be a non-empty array");
    continue;
  }

  migration.statements.forEach((statement, index) => {
    const label = `statement ${index + 1}`;
    const firstLine = statement.trim().split("\n")[0].slice(0, 62);

    if (statement.trim().endsWith(";")) {
      // Postgres rejects a trailing semicolon on a statement sent alone inside a
      // transaction, so this would fail only at deploy time.
      fail(`${label} ends with a semicolon`);
    } else {
      console.log(`  ok    ${label}: ${firstLine}`);
    }

    if (/undefined/.test(statement)) {
      fail(`${label} contains "undefined": an escape went wrong somewhere`);
    }

    /*
     * A "${" inside a SQL regex literal means the quantifier ended up applied to
     * whatever preceded the dollar, usually the end anchor. Postgres reports
     * this as "invalid regular expression: quantifier operand invalid" and only
     * when a row is first inserted, so it sails through DDL and a migration.
     */
    for (const pattern of statement.match(/~ '[^']*'|\$[A-Za-z]+\[[^\]]*\]\$?/g) || []) {
      // Built by concatenation on purpose: a literal dollar-brace inside a
      // template literal is exactly the bug this check exists to catch.
      const badSequence = "$" + "{";
      if (pattern.includes(badSequence)) {
        fail(
          `${label} has a dollar-brace inside a regex, so the quantifier binds to the ` +
            "preceding character instead of the class. Write {2,8}$ and escape only " +
            "the dollar that precedes the brace in the JS source.",
        );
      }
    }

    for (const pattern of statement.match(/~ '[^']+'/g) || []) {
      console.log(`  ok    ${label}: ${pattern}`);
    }

    // Placeholders must be numbered 1..n with no gaps or duplicates.
    const numbers = [...statement.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
    if (numbers.length) {
      const unique = [...new Set(numbers)].sort((a, b) => a - b);
      const expected = Array.from({ length: unique.length }, (_, i) => i + 1);
      if (unique.join(",") !== expected.join(",")) {
        fail(`${label} placeholders are ${unique.join(",")}, expected ${expected.join(",")}`);
      } else {
        console.log(`  ok    ${label}: $1..$${unique.length}`);
      }
    }
  });
}

console.log("");
if (problems) {
  console.error(`${problems} problem(s) found.`);
  process.exit(1);
}
console.log("All migration statements passed the static checks.");
