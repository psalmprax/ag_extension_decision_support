const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function seed() {
  console.log('--- Seeding Database (JS) ---');
  
  try {
    const client = await pool.connect();
    console.log('Connected to DB');
    
    // Create tables just in case
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'extension_officer',
        region VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS farmers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        region VARCHAR(100),
        village VARCHAR(100),
        crops TEXT[],
        farm_size_hectares DECIMAL(10, 2),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS visits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        officer_id UUID REFERENCES users(id),
        farmer_id UUID REFERENCES farmers(id),
        visit_type VARCHAR(50) DEFAULT 'routine',
        status VARCHAR(50) DEFAULT 'scheduled',
        scheduled_at TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chat_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id UUID REFERENCES farmers(id),
        status VARCHAR(50) DEFAULT 'active',
        language VARCHAR(20) DEFAULT 'en',
        started_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES chat_conversations(id),
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Add extension officer
    const passwordHash = await bcrypt.hash('password123', 10);
    const userRes = await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role, region)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id
    `, ['john.smith@extension.org', passwordHash, 'John', 'Smith', 'extension_officer', 'Nairobi']);
    
    const officerId = userRes.rows[0].id;
    console.log(`User seeded: ${officerId}`);

    // Add farmers
    const farmers = [
      ['Samuel', 'Kiptoo', '+254700111222', 'Nairobi', 'Kibera', '{Maize, Beans}', 2.5],
      ['Mary', 'Wambui', '+254700333444', 'Nairobi', 'Kibera', '{Tomatoes, Kale}', 1.2],
      ['David', 'Ndungu', '+254700555666', 'Mombasa', 'Likoni', '{Coconuts, Cashews}', 5.5]
    ];

    for (const f of farmers) {
      const res = await client.query(`
        INSERT INTO farmers (first_name, last_name, phone, region, village, crops, farm_size_hectares, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING
        RETURNING id
      `, [...f, officerId]);
      
      const farmerId = res.rows[0]?.id;
      if (farmerId) {
        // Add a visit for each farmer
        await client.query(`
          INSERT INTO visits (officer_id, farmer_id, visit_type, status, scheduled_at, notes)
          VALUES ($1, $2, 'routine', 'completed', NOW() - INTERVAL '2 days', 'Regular checkup')
        `, [officerId, farmerId]);

        // Add a conversation
        const convRes = await client.query(`
          INSERT INTO chat_conversations (farmer_id, status, language, started_at)
          VALUES ($1, 'active', 'en', NOW() - INTERVAL '1 day')
          RETURNING id
        `, [farmerId]);
        
        await client.query(`
          INSERT INTO chat_messages (conversation_id, role, content, created_at)
          VALUES ($1, 'farmer', 'How is the weather today?', NOW() - INTERVAL '1 day')
        `, [convRes.rows[0].id]);
      }
    }
    console.log('Farmers, visits and conversations seeded');

    client.release();
    console.log('--- Seeding Completed ---');
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await pool.end();
  }
}

seed();
