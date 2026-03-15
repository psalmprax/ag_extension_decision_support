/**
 * Database Migration: Add language_preference to farmers table
 * 
 * This migration adds support for multi-language functionality by adding
 * a language_preference column to the farmers table.
 * 
 * Run with: npx ts-node migrations/add_language_preference.ts
 */

import { getPool, query } from '../src/services/databaseService';

async function migrate() {
    console.log('Starting migration: add_language_preference');

    const pool = getPool();

    if (!pool) {
        console.error('Database connection not available. Make sure DATABASE_URL is set.');
        process.exit(1);
    }

    try {
        // Check if column exists
        const checkResult = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'farmers' AND column_name = 'language_preference'
        `);

        if (checkResult.rows.length > 0) {
            console.log('Column language_preference already exists. Skipping migration.');
            return;
        }

        // Add column
        await query(`
            ALTER TABLE farmers 
            ADD COLUMN language_preference VARCHAR(10) DEFAULT 'en'
        `);

        console.log('Successfully added language_preference column to farmers table');

        // Also add to farmer_queries table for tracking query language
        const checkQueriesResult = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'farmer_queries' AND column_name = 'language'
        `);

        if (checkQueriesResult.rows.length === 0) {
            await query(`
                ALTER TABLE farmer_queries 
                ADD COLUMN language VARCHAR(10) DEFAULT 'en'
            `);
            console.log('Successfully added language column to farmer_queries table');
        }

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

// Run migration
migrate();
