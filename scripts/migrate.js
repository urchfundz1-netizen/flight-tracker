/**
 * Applies any pending schema migrations.
 *
 * The app also migrates itself on first query, so this script is not required
 * for a normal deploy. It exists for two cases:
 *
 *   - verifying the schema before the app has ever run against the database
 *   - recovering when a migration failed and you want the error on its own,
 *     rather than buried in a request log
 *
 *   npm run migrate
 */

const { migrate } = await import("../lib/db.js");

try {
  const applied = await migrate();
  console.log(applied === 0 ? "Database schema is already up to date." : `Applied ${applied} migration(s).`);
  process.exit(0);
} catch (error) {
  console.error(`Migration failed: ${error.message}`);
  console.error("");
  console.error("");
  console.error("Each migration is applied in its own transaction, so this one left no partial");
  console.error("state behind. Earlier migrations in the list were applied and recorded normally.");
  console.error("Fix the cause and re-run this script.");
  process.exit(1);
}
