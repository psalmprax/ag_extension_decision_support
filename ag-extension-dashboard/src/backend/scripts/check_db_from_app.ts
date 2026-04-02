
import { initializeDatabase, query } from '../src/services/databaseService';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function check() {
    console.log('Connecting to:', process.env.DATABASE_URL);
    await initializeDatabase();
    
    try {
        const result = await query(`
            SELECT table_schema, table_name, column_name 
            FROM information_schema.columns 
            WHERE table_name = 'search_cache'
            ORDER BY table_schema, column_name;
        `);
        console.log('Columns in search_cache:');
        console.table(result.rows);
    } catch (error) {
        console.error('Error checking columns:', error);
    } finally {
        process.exit(0);
    }
}

check();
