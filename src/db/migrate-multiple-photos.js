import { pool } from './index.js';

async function migrate() {
  console.log('Migrating database to support multiple photos...');

  try {
    // Step 1: Add new columns if they don't exist
    await pool.query(`
      ALTER TABLE requests 
      ADD COLUMN IF NOT EXISTS photo_file_ids JSONB NOT NULL DEFAULT '[]';
    `);

    await pool.query(`
      ALTER TABLE requests 
      ADD COLUMN IF NOT EXISTS resolved_photo_ids JSONB NOT NULL DEFAULT '[]';
    `);

    // Step 2: Copy existing data from photo_file_id and resolved_photo to new JSONB arrays
    await pool.query(`
      UPDATE requests 
      SET photo_file_ids = COALESCE(
        CASE WHEN photo_file_id IS NOT NULL THEN jsonb_build_array(photo_file_id) ELSE '[]' END, '[]'
      );
    `);

    await pool.query(`
      UPDATE requests 
      SET resolved_photo_ids = COALESCE(
        CASE WHEN resolved_photo IS NOT NULL THEN jsonb_build_array(resolved_photo) ELSE '[]' END, '[]'
      );
    `);

    // Step 3: Drop old columns (optional, but let's do it to clean up)
    await pool.query('ALTER TABLE requests DROP COLUMN IF EXISTS photo_file_id;');
    await pool.query('ALTER TABLE requests DROP COLUMN IF EXISTS resolved_photo;');

    console.log('✅ Migration completed!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();