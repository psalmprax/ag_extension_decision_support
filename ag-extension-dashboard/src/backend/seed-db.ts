import { query, getPool } from './src/services/databaseService';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
    console.log('--- Seeding Database ---');
    const pool = getPool();
    
    // We need to wait for pool to be initialized if we were running this inside the app, 
    // but here we'll just manually initialize or assume it's callable if we use the service.
    // However, since this is a standalone script, let's just use the query function and hope pool is init.
    // Actually, let's just write a clean script.
    
    try {
        // Create a default extension officer
        const passwordHash = await bcrypt.hash('password123', 10);
        const userResult = await query(`
            INSERT INTO users (email, password_hash, first_name, last_name, role, region, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
            RETURNING id
        `, ['john.smith@extension.org', passwordHash, 'John', 'Smith', 'extension_officer', 'Nairobi', true]);
        
        const officerId = userResult.rows[0].id;
        console.log(`User created/updated: ${officerId}`);

        // Create some farmers
        const farmers = [
            ['Samuel', 'Kiptoo', '+254700111222', 'Nairobi', 'Kibera', 'Dagoretti', '{Maize, Beans}', 2.5],
            ['Mary', 'Wambui', '+254700333444', 'Nairobi', 'Kibera', 'Dagoretti', '{Tomatoes, Kale}', 1.2],
            ['David', 'Ndungu', '+254700555666', 'Rift Valley', 'Eldoret', 'Uasin Gishu', '{Wheat, Tea}', 15.0]
        ];

        for (const f of farmers) {
            await query(`
                INSERT INTO farmers (first_name, last_name, phone, region, village, district, crops, farm_size_hectares, user_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT DO NOTHING
            `, [...f, officerId]);
        }
        console.log('Farmers seeded');

        // Create some knowledge articles if they don't exist
        const articles = [
            ['Maize Planting Guide', 'Best practices for planting maize in Kenya include...', 'Maize', 'Nairobi'],
            ['Pest Control for Tomatoes', 'To control whiteflies in tomatoes, use...', 'Tomatoes', 'Nairobi']
        ];

        for (const a of articles) {
            await query(`
                INSERT INTO knowledge_articles (title, content, summary, tags, crops, regions)
                VALUES ($1, $2, $1, '{guide, pests}', ARRAY[$3], ARRAY[$4])
                ON CONFLICT DO NOTHING
            `, a);
        }
        console.log('Knowledge articles seeded');

        console.log('--- Seeding Completed ---');
    } catch (error) {
        console.error('Seeding failed:', error);
    }
}

// Manually initialize pool for the script
import { Pool } from 'pg';
import { config } from './src/config';
const pool = new Pool({ connectionString: config.database.url });
// Override the internal pool for this script
(global as any).__pool = pool; 

seed().then(() => process.exit(0));
