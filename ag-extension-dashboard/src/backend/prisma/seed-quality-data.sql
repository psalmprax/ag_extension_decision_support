-- =============================================================
-- Quality Seed Data: Multi-Region Users & Farmers
-- Tests row-level security: officers see only their assignments
-- =============================================================

-- 1. USERS (4 regions, various roles)
-- =============================================================
-- Admin (sees everything)
INSERT INTO users (id, email, password_hash, first_name, last_name, role, region, phone, created_at)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin@agridemo.com',
    '$2b$10$placeholder_hash_placeholder_hash_placeholder_hash_',
    'System', 'Administrator', 'admin', 'Global', '+1000000001',
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Regional Managers (1 per region)
INSERT INTO users (id, email, password_hash, first_name, last_name, role, region, phone, created_at)
VALUES
    ('b1000000-0000-0000-0000-000000000001', 'rm.lilongwe@agridemo.com', '$2b$10$placeholder', 'Grace', 'Banda', 'regional_manager', 'Lilongwe', '+265880000001', NOW()),
    ('b1000000-0000-0000-0000-000000000002', 'rm.kumasi@agridemo.com', '$2b$10$placeholder', 'Kwame', 'Asante', 'regional_manager', 'Kumasi', '+233200000002', NOW()),
    ('b1000000-0000-0000-0000-000000000003', 'rm.lusaka@agridemo.com', '$2b$10$placeholder', 'Blessing', 'Zulu', 'regional_manager', 'Lusaka', '+260950000003', NOW()),
    ('b1000000-0000-0000-0000-000000000004', 'rm.dhaka@agridemo.com', '$2b$10$placeholder', 'Rahima', 'Begum', 'regional_manager', 'Dhaka', '+880170000004', NOW())
ON CONFLICT (email) DO NOTHING;

-- Extension Officers (2 per region = 8 total)
INSERT INTO users (id, email, password_hash, first_name, last_name, role, region, phone, created_at)
VALUES
    -- Lilongwe, Malawi
    ('c2000000-0000-0000-0000-000000000001', 'officer.chimwaza@agridemo.com', '$2b$10$placeholder', 'James', 'Chimwaza', 'extension_officer', 'Lilongwe', '+265881000001', NOW()),
    ('c2000000-0000-0000-0000-000000000002', 'officer.phiri@agridemo.com', '$2b$10$placeholder', 'Mary', 'Phiri', 'extension_officer', 'Lilongwe', '+265881000002', NOW()),
    -- Kumasi, Ghana
    ('c2000000-0000-0000-0000-000000000003', 'officer.mensah@agridemo.com', '$2b$10$placeholder', 'Kofi', 'Mensah', 'extension_officer', 'Kumasi', '+233201000003', NOW()),
    ('c2000000-0000-0000-0000-000000000004', 'officer.osei@agridemo.com', '$2b$10$placeholder', 'Ama', 'Osei', 'extension_officer', 'Kumasi', '+233201000004', NOW()),
    -- Lusaka, Zambia
    ('c2000000-0000-0000-0000-000000000005', 'officer.mwale@agridemo.com', '$2b$10$placeholder', 'Chanda', 'Mwale', 'extension_officer', 'Lusaka', '+260951000005', NOW()),
    ('c2000000-0000-0000-0000-000000000006', 'officer.banda@agridemo.com', '$2b$10$placeholder', 'Thandiwe', 'Banda', 'extension_officer', 'Lusaka', '+260951000006', NOW()),
    -- Dhaka, Bangladesh
    ('c2000000-0000-0000-0000-000000000007', 'officer.hossain@agridemo.com', '$2b$10$placeholder', 'Karim', 'Hossain', 'extension_officer', 'Dhaka', '+880171000007', NOW()),
    ('c2000000-0000-0000-0000-000000000008', 'officer.akter@agridemo.com', '$2b$10$placeholder', 'Fatima', 'Akter', 'extension_officer', 'Dhaka', '+880171000008', NOW())
ON CONFLICT (email) DO NOTHING;

-- Farmer users (4 total, 1 per region)
INSERT INTO users (id, email, password_hash, first_name, last_name, role, region, phone, created_at)
VALUES
    ('d3000000-0000-0000-0000-000000000001', 'farmer.mkandawire@agridemo.com', '$2b$10$placeholder', 'Joseph', 'Mkandawire', 'farmer', 'Lilongwe', '+265882000001', NOW()),
    ('d3000000-0000-0000-0000-000000000002', 'farmer.boateng@agridemo.com', '$2b$10$placeholder', 'Akua', 'Boateng', 'farmer', 'Kumasi', '+233202000002', NOW()),
    ('d3000000-0000-0000-0000-000000000003', 'farmer.tembo@agridemo.com', '$2b$10$placeholder', 'Loveness', 'Tembo', 'farmer', 'Lusaka', '+260952000003', NOW()),
    ('d3000000-0000-0000-0000-000000000004', 'farmer.rahman@agridemo.com', '$2b$10$placeholder', 'Nasrin', 'Rahman', 'farmer', 'Dhaka', '+880172000004', NOW())
ON CONFLICT (email) DO NOTHING;

-- 2. FARMERS (5 per region = 20 total, assigned to officers)
-- =============================================================

-- LILONGWE, MALAWI — assigned to Chimwaza (001) and Phiri (002)
INSERT INTO farmers (id, user_id, assigned_officer_id, first_name, last_name, phone, village, district, region, country, farm_size_hectares, crops, vital_score, soil_moisture, temperature, ph_level, ai_confidence, language_preference, location_lat, location_lng, created_at)
VALUES
    ('f1000000-0000-0000-0000-000000000001', NULL, 'c2000000-0000-0000-0000-000000000001', 'Joseph', 'Mkandawire', '+265882000001', 'Kawale', 'Lilongwe', 'Lilongwe', 'Malawi', 2.5, ARRAY['maize', 'groundnuts'], 78.5, 42.3, 28.5, 6.2, 85.0, 'ny', -13.9833, 33.7833, NOW()),
    ('f1000000-0000-0000-0000-000000000002', NULL, 'c2000000-0000-0000-0000-000000000001', 'Agnes', 'Kamanga', '+265882000002', 'Nsungwi', 'Lilongwe', 'Lilongwe', 'Malawi', 1.8, ARRAY['maize', 'tobacco'], 65.2, 38.1, 29.0, 5.8, 72.0, 'ny', -13.9500, 33.8000, NOW()),
    ('f1000000-0000-0000-0000-000000000003', NULL, 'c2000000-0000-0000-0000-000000000001', 'Patrick', 'Banda', '+265882000003', 'Chitedze', 'Lilongwe', 'Lilongwe', 'Malawi', 3.2, ARRAY['soybean', 'maize'], 82.1, 45.0, 27.8, 6.5, 90.0, 'ny', -13.9667, 33.7500, NOW()),
    ('f1000000-0000-0000-0000-000000000004', NULL, 'c2000000-0000-0000-0000-000000000002', 'Esther', 'Mvula', '+265882000004', 'Mitundu', 'Lilongwe', 'Lilongwe', 'Malawi', 1.5, ARRAY['cassava', 'sweet potato'], 71.0, 40.2, 28.2, 6.0, 78.0, 'ny', -14.0167, 33.8167, NOW()),
    ('f1000000-0000-0000-0000-000000000005', NULL, 'c2000000-0000-0000-0000-000000000002', 'Temwa', 'Ngwira', '+265882000005', 'Lumbadzi', 'Lilongwe', 'Lilongwe', 'Malawi', 4.0, ARRAY['tobacco', 'groundnuts', 'maize'], 88.3, 48.5, 27.0, 6.8, 92.0, 'ny', -13.9333, 33.7000, NOW())
ON CONFLICT (id) DO NOTHING;

-- KUMASI, GHANA — assigned to Mensah (003) and Osei (004)
INSERT INTO farmers (id, user_id, assigned_officer_id, first_name, last_name, phone, village, district, region, country, farm_size_hectares, crops, vital_score, soil_moisture, temperature, ph_level, ai_confidence, language_preference, location_lat, location_lng, created_at)
VALUES
    ('f2000000-0000-0000-0000-000000000001', NULL, 'c2000000-0000-0000-0000-000000000003', 'Kwaku', 'Owusu', '+233202000001', 'Ejisu', 'Kumasi', 'Kumasi', 'Ghana', 3.0, ARRAY['cocoa', 'cassava'], 75.0, 55.2, 30.5, 5.5, 80.0, 'en', 6.7167, -1.5167, NOW()),
    ('f2000000-0000-0000-0000-000000000002', NULL, 'c2000000-0000-0000-0000-000000000003', 'Abena', 'Adjei', '+233202000002', 'Bantama', 'Kumasi', 'Kumasi', 'Ghana', 1.2, ARRAY['plantain', 'cocoyam'], 68.5, 50.8, 31.0, 5.2, 70.0, 'en', 6.6833, -1.6167, NOW()),
    ('f2000000-0000-0000-0000-000000000003', NULL, 'c2000000-0000-0000-0000-000000000003', 'Yaw', 'Frimpong', '+233202000003', 'Ahinsan', 'Kumasi', 'Kumasi', 'Ghana', 5.0, ARRAY['cocoa', 'oil palm'], 90.0, 58.0, 29.5, 5.8, 95.0, 'en', 6.7500, -1.4833, NOW()),
    ('f2000000-0000-0000-0000-000000000004', NULL, 'c2000000-0000-0000-0000-000000000004', 'Efua', 'Boateng', '+233202000004', 'Atonsu', 'Kumasi', 'Kumasi', 'Ghana', 2.0, ARRAY['maize', 'vegetables'], 62.0, 48.0, 30.8, 6.0, 65.0, 'en', 6.6667, -1.5500, NOW()),
    ('f2000000-0000-0000-0000-000000000005', NULL, 'c2000000-0000-0000-0000-000000000004', 'Kojo', 'Amponsah', '+233202000005', 'Suame', 'Kumasi', 'Kumasi', 'Ghana', 1.8, ARRAY['cassava', 'maize'], 55.0, 45.5, 31.5, 5.0, 60.0, 'en', 6.7000, -1.6333, NOW())
ON CONFLICT (id) DO NOTHING;

-- LUSAKA, ZAMBIA — assigned to Mwale (005) and Banda (006)
INSERT INTO farmers (id, user_id, assigned_officer_id, first_name, last_name, phone, village, district, region, country, farm_size_hectares, crops, vital_score, soil_moisture, temperature, ph_level, ai_confidence, language_preference, location_lat, location_lng, created_at)
VALUES
    ('f3000000-0000-0000-0000-000000000001', NULL, 'c2000000-0000-0000-0000-000000000005', 'Loveness', 'Tembo', '+260952000001', 'Chelston', 'Lusaka', 'Lusaka', 'Zambia', 2.0, ARRAY['maize', 'soybean'], 80.0, 40.0, 25.0, 6.3, 88.0, 'ny', -15.4167, 28.2833, NOW()),
    ('f3000000-0000-0000-0000-000000000002', NULL, 'c2000000-0000-0000-0000-000000000005', 'Mwila', 'Zulu', '+260952000002', 'Kalingalinga', 'Lusaka', 'Lusaka', 'Zambia', 1.5, ARRAY['vegetables', 'tomatoes'], 72.0, 42.5, 24.5, 6.1, 75.0, 'ny', -15.3833, 28.3333, NOW()),
    ('f3000000-0000-0000-0000-000000000003', NULL, 'c2000000-0000-0000-0000-000000000005', 'Gift', 'Phiri', '+260952000003', 'Chilenje', 'Lusaka', 'Lusaka', 'Zambia', 3.5, ARRAY['maize', 'groundnuts', 'cotton'], 85.0, 44.0, 26.0, 6.5, 91.0, 'ny', -15.4000, 28.3167, NOW()),
    ('f3000000-0000-0000-0000-000000000004', NULL, 'c2000000-0000-0000-0000-000000000006', 'Mutale', 'Kapenda', '+260952000004', 'Kabulonga', 'Lusaka', 'Lusaka', 'Zambia', 2.8, ARRAY['wheat', 'barley'], 76.0, 38.0, 23.5, 6.8, 82.0, 'ny', -15.3667, 28.2667, NOW()),
    ('f3000000-0000-0000-0000-000000000005', NULL, 'c2000000-0000-0000-0000-000000000006', 'Precious', 'Sakala', '+260952000005', 'Matero', 'Lusaka', 'Lusaka', 'Zambia', 1.0, ARRAY['vegetables', 'onions'], 60.0, 36.5, 25.5, 5.9, 58.0, 'ny', -15.4333, 28.2500, NOW())
ON CONFLICT (id) DO NOTHING;

-- DHAKA, BANGLADESH — assigned to Hossain (007) and Akter (008)
INSERT INTO farmers (id, user_id, assigned_officer_id, first_name, last_name, phone, village, district, region, country, farm_size_hectares, crops, vital_score, soil_moisture, temperature, ph_level, ai_confidence, language_preference, location_lat, location_lng, created_at)
VALUES
    ('f4000000-0000-0000-0000-000000000001', NULL, 'c2000000-0000-0000-0000-000000000007', 'Nasrin', 'Rahman', '+880172000001', 'Mirpur', 'Dhaka', 'Dhaka', 'Bangladesh', 0.8, ARRAY['rice', 'jute'], 70.0, 65.0, 32.0, 5.5, 75.0, 'bn', 23.8000, 90.3667, NOW()),
    ('f4000000-0000-0000-0000-000000000002', NULL, 'c2000000-0000-0000-0000-000000000007', 'Rafiq', 'Islam', '+880172000002', 'Uttara', 'Dhaka', 'Dhaka', 'Bangladesh', 1.2, ARRAY['rice', 'wheat', 'mustard'], 78.0, 62.0, 31.5, 5.8, 82.0, 'bn', 23.8667, 90.4000, NOW()),
    ('f4000000-0000-0000-0000-000000000003', NULL, 'c2000000-0000-0000-0000-000000000007', 'Salma', 'Khatun', '+880172000003', 'Gulshan', 'Dhaka', 'Dhaka', 'Bangladesh', 0.5, ARRAY['vegetables', 'chili'], 55.0, 58.0, 33.0, 5.2, 50.0, 'bn', 23.7833, 90.4167, NOW()),
    ('f4000000-0000-0000-0000-000000000004', NULL, 'c2000000-0000-0000-0000-000000000008', 'Kamal', 'Uddin', '+880172000004', 'Mohammadpur', 'Dhaka', 'Dhaka', 'Bangladesh', 2.0, ARRAY['rice', 'fish (aquaculture)'], 82.0, 70.0, 30.5, 6.0, 88.0, 'bn', 23.7667, 90.3500, NOW()),
    ('f4000000-0000-0000-0000-000000000005', NULL, 'c2000000-0000-0000-0000-000000000008', 'Farida', 'Begum', '+880172000005', 'Tejgaon', 'Dhaka', 'Dhaka', 'Bangladesh', 0.6, ARRAY['rice', 'pulses'], 63.0, 60.0, 32.5, 5.6, 68.0, 'bn', 23.7500, 90.3833, NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. LINK FARMER USERS TO THEIR FARMER RECORDS
-- =============================================================
UPDATE farmers SET user_id = 'd3000000-0000-0000-0000-000000000001' WHERE id = 'f1000000-0000-0000-0000-000000000001';
UPDATE farmers SET user_id = 'd3000000-0000-0000-0000-000000000002' WHERE id = 'f2000000-0000-0000-0000-000000000001';
UPDATE farmers SET user_id = 'd3000000-0000-0000-0000-000000000003' WHERE id = 'f3000000-0000-0000-0000-000000000001';
UPDATE farmers SET user_id = 'd3000000-0000-0000-0000-000000000004' WHERE id = 'f4000000-0000-0000-0000-000000000001';
