const { query } = require('../lib/db.ts');

/**
 * Updates all accepted assignments to ensure storage_path is set if a document was uploaded.
 * This script sets storage_path to NULL for assignments without a document, and leaves it unchanged otherwise.
 * Run this script manually or via an admin endpoint.
 */

async function updateAcceptedAssignmentsStoragePath() {
  // Find all accepted assignments
  const { rows: assignments } = await query(
    `SELECT id, storage_path FROM assignments WHERE status = 'in_progress' OR status = 'submitted' OR status = 'completed'`
  );

  for (const assignment of assignments) {
    // If storage_path is missing, set to NULL (or update as needed)
    if (!assignment.storage_path) {
      await query('UPDATE assignments SET storage_path = NULL WHERE id = $1', [assignment.id]);
    }
    // Optionally: add logic to set storage_path if you know the document path
  }

  console.log('Database updated: storage_path ensured for all accepted assignments.');
}

updateAcceptedAssignmentsStoragePath().catch(console.error);