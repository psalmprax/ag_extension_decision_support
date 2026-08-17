-- Fix demo user data: reassign any leftover officer farmers, then seed the
-- canonical demo dataset (12 Kenyan farmers matching the frontend DEMO_FARMERS).
--
-- Farmer IDs here match `prisma/demoFarmers.ts` so this SQL and the Prisma
-- seed converge on the same rows regardless of deployment path.

-- Reassign original farmers back to chimwaza (undo any previous misassignment)
UPDATE farmers SET assigned_officer_id = (SELECT id FROM users WHERE email = 'officer.chimwaza@agridemo.com')
WHERE assigned_officer_id = (SELECT id FROM users WHERE email = 'demo@agridemo.com');

-- Seed the 12 demo farmers, assigned to the demo officer
INSERT INTO farmers (id, assigned_officer_id, first_name, last_name, phone, location, village, district, region, country, farm_size_hectares, crops, vital_score, soil_moisture, temperature, ph_level, ai_confidence, yield_history, location_lat, location_lng, language_preference, created_at, updated_at)
VALUES
    ('d1000000-0000-0000-0000-000000000001', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'Emmanuel', 'Mwangi', '+254712345601', 'Machakos Rural, Eastern Zone', 'Kathiani', 'Machakos', 'Machakos', 'Kenya', 3.5, ARRAY['Maize','Beans'], 62, 42.0, 23.5, 6.1, 74, '[{"month":"Avg","yield":4.2}]'::jsonb, -1.5177, 37.2634, 'en', NOW(), NOW()),
    ('d1000000-0000-0000-0000-000000000002', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'Grace', 'Wanjiku', '+254712345602', 'Kiambu Highlands', 'Githunguri', 'Kiambu', 'Kiambu', 'Kenya', 2.2, ARRAY['Coffee','Maize'], 71, 45.5, 21.0, 5.9, 81, '[{"month":"Avg","yield":5.8}]'::jsonb, -1.0500, 36.8500, 'en', NOW(), NOW()),
    ('d1000000-0000-0000-0000-000000000003', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'David', 'Kiprono', '+254712345603', 'Rift Valley Basin, Nakuru', 'Njoro', 'Nakuru', 'Nakuru', 'Kenya', 5.0, ARRAY['Potatoes','Wheat'], 88, 47.0, 19.5, 6.4, 92, '[{"month":"Avg","yield":8.4}]'::jsonb, -0.3031, 36.0800, 'en', NOW(), NOW()),
    ('d1000000-0000-0000-0000-000000000004', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'Amina', 'Hassan', '+254712345604', 'Kilifi Coastal Strip', 'Malindi Sub-County', 'Kilifi', 'Kilifi', 'Kenya', 4.1, ARRAY['Cassava','Cashew'], 74, 50.5, 28.0, 6.2, 84, '[{"month":"Avg","yield":6.1}]'::jsonb, -3.2200, 40.1167, 'sw', NOW(), NOW()),
    ('d1000000-0000-0000-0000-000000000005', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'Samuel', 'Otieno', '+254712345605', 'Lake Basin, Kisumu', 'Kano Plains', 'Kisumu', 'Kisumu', 'Kenya', 1.8, ARRAY['Rice','Sorghum'], 58, 55.0, 26.5, 5.8, 68, '[{"month":"Avg","yield":3.9}]'::jsonb, -0.0917, 34.7680, 'luo', NOW(), NOW()),
    ('d1000000-0000-0000-0000-000000000006', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'Faith', 'Chebet', '+254712345606', 'Eldoret North Grain Belt', 'Turbo', 'Uasin Gishu', 'Uasin Gishu', 'Kenya', 6.5, ARRAY['Maize','Soybeans'], 93, 44.0, 18.0, 6.6, 95, '[{"month":"Avg","yield":9.2}]'::jsonb, 0.5143, 35.2698, 'kal', NOW(), NOW()),
    ('d1000000-0000-0000-0000-000000000007', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'Joseph', 'Mutua', '+254712345607', 'Meru Eastern Slopes', 'Timau', 'Meru', 'Meru', 'Kenya', 2.8, ARRAY['Tea','Avocado'], 84, 46.5, 17.5, 5.6, 90, '[{"month":"Avg","yield":7.5}]'::jsonb, 0.0500, 37.6500, 'en', NOW(), NOW()),
    ('d1000000-0000-0000-0000-000000000008', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'Esther', 'Nyambura', '+254712345608', 'Nyeri Hillside Agro-Forest', 'Othaya', 'Nyeri', 'Nyeri', 'Kenya', 1.5, ARRAY['Coffee','Macadamia'], 66, 48.0, 19.0, 5.7, 77, '[{"month":"Avg","yield":4.8}]'::jsonb, -0.4167, 36.9500, 'en', NOW(), NOW()),
    ('d1000000-0000-0000-0000-000000000009', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'Brian', 'Wekesa', '+254712345609', 'Trans Nzoia Valley', 'Endebess', 'Trans Nzoia', 'Kitale', 'Kenya', 8.0, ARRAY['Maize','Sunflower'], 95, 43.0, 18.5, 6.5, 96, '[{"month":"Avg","yield":11.0}]'::jsonb, 1.0167, 35.0000, 'en', NOW(), NOW()),
    ('d1000000-0000-0000-0000-000000000010', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'Lydia', 'Moraa', '+254712345610', 'Kisii Highland Terraces', 'Suneka', 'Kisii', 'Kisii', 'Kenya', 1.2, ARRAY['Bananas','Tea'], 68, 51.0, 20.5, 5.9, 79, '[{"month":"Avg","yield":5.1}]'::jsonb, -0.6817, 34.7667, 'en', NOW(), NOW()),
    ('d1000000-0000-0000-0000-000000000011', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'Peter', 'Maina', '+254712345611', 'Muranga Agro Zone', 'Kangema', 'Murang''a', 'Muranga', 'Kenya', 3.0, ARRAY['Avocado','Coffee'], 79, 46.0, 20.0, 6.0, 87, '[{"month":"Avg","yield":6.8}]'::jsonb, -0.7167, 37.1500, 'en', NOW(), NOW()),
    ('d1000000-0000-0000-0000-000000000012', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'Beatrice', 'Cherotich', '+254712345612', 'Bomet South Escarpment', 'Sotik', 'Bomet', 'Bomet', 'Kenya', 4.5, ARRAY['Tea','Dairy Pasture'], 82, 45.0, 17.8, 5.8, 89, '[{"month":"Avg","yield":7.2}]'::jsonb, -0.7813, 35.3416, 'kal', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create visits for demo user farmers
INSERT INTO visits (id, officer_id, farmer_id, visit_type, status, scheduled_at, started_at, completed_at, duration_minutes, notes, outcomes, follow_up_required, created_at)
VALUES
    ('db000000-0000-0000-0000-000000000001', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'd1000000-0000-0000-0000-000000000001', 'routine', 'completed', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days' + INTERVAL '40 minutes', 40, 'Maize at V6 stage. Good stand count.', 'No issues. Continue current fertilizer schedule.', false, NOW() - INTERVAL '14 days'),
    ('db000000-0000-0000-0000-000000000002', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'd1000000-0000-0000-0000-000000000002', 'soil_testing', 'completed', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days' + INTERVAL '30 minutes', 30, 'Soil pH 5.9, good nitrogen levels.', 'Recommended coffee-maize rotation continues.', false, NOW() - INTERVAL '7 days'),
    ('db000000-0000-0000-0000-000000000003', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'd1000000-0000-0000-0000-000000000003', 'routine', 'scheduled', NOW() + INTERVAL '3 days', NULL, NULL, NULL, 'Check potato growth and wheat emergence.', NULL, false, NOW())
ON CONFLICT (id) DO NOTHING;

-- Create notifications for demo user
INSERT INTO notifications (id, user_id, type, title, message, is_read, channel, created_at)
VALUES
    ('de000000-0000-0000-0000-000000000001', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'success', 'Visit Completed', 'Visit with Emmanuel Mwangi completed successfully.', true, 'in_app', NOW() - INTERVAL '14 days'),
    ('de000000-0000-0000-0000-000000000002', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'info', 'Upcoming Visit', 'Scheduled visit with David Kiprono in 3 days.', false, 'in_app', NOW())
ON CONFLICT (id) DO NOTHING;
