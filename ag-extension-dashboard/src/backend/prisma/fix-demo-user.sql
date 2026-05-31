-- Fix demo user data: reassign chimwaza farmers back, create new demo farmers

-- Reassign original farmers back to chimwaza
UPDATE farmers SET assigned_officer_id = (SELECT id FROM users WHERE email = 'officer.chimwaza@agridemo.com')
WHERE assigned_officer_id = (SELECT id FROM users WHERE email = 'demo@agridemo.com');

-- Create new farmers for demo user
INSERT INTO farmers (id, first_name, last_name, phone, village, district, region, country, farm_size_hectares, crops, vital_score, soil_moisture, temperature, ph_level, ai_confidence, assigned_officer_id, language_preference, created_at, updated_at)
VALUES
    ('fa000000-0000-0000-0000-000000000001', 'Chimwemwe', 'Banda', '+265881000001', 'Area 25', 'Lilongwe', 'Lilongwe', 'Malawi', 2.5, ARRAY['maize','groundnuts'], 78.5, 45.2, 26.5, 6.4, 88, (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'ny', NOW(), NOW()),
    ('fa000000-0000-0000-0000-000000000002', 'Thoko', 'Phiri', '+265881000002', 'Kanengo', 'Lilongwe', 'Lilongwe', 'Malawi', 1.8, ARRAY['soybean','maize'], 72.3, 52.1, 25.8, 6.7, 82, (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'ny', NOW(), NOW()),
    ('fa000000-0000-0000-0000-000000000003', 'Dalitso', 'Mvula', '+265881000003', 'Lumbadzi', 'Lilongwe', 'Lilongwe', 'Malawi', 3.2, ARRAY['cassava','groundnuts'], 85.1, 41.3, 27.2, 6.2, 91, (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'ny', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create visits for demo user farmers
INSERT INTO visits (id, officer_id, farmer_id, visit_type, status, scheduled_at, started_at, completed_at, duration_minutes, notes, outcomes, follow_up_required, created_at)
VALUES
    ('db000000-0000-0000-0000-000000000001', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'fa000000-0000-0000-0000-000000000001', 'routine', 'completed', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days' + INTERVAL '40 minutes', 40, 'Maize at V6 stage. Good stand count.', 'No issues. Continue current fertilizer schedule.', false, NOW() - INTERVAL '14 days'),
    ('db000000-0000-0000-0000-000000000002', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'fa000000-0000-0000-0000-000000000002', 'soil_testing', 'completed', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days' + INTERVAL '30 minutes', 30, 'Soil pH 6.7, good nitrogen levels.', 'Recommended soybean-maize rotation continues.', false, NOW() - INTERVAL '7 days'),
    ('db000000-0000-0000-0000-000000000003', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'fa000000-0000-0000-0000-000000000003', 'routine', 'scheduled', NOW() + INTERVAL '3 days', NULL, NULL, NULL, 'Check cassava growth and groundnut emergence.', NULL, false, NOW())
ON CONFLICT (id) DO NOTHING;

-- Create notifications for demo user
INSERT INTO notifications (id, user_id, type, title, message, is_read, channel, created_at)
VALUES
    ('de000000-0000-0000-0000-000000000001', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'success', 'Visit Completed', 'Visit with Chimwemwe Banda completed successfully.', true, 'in_app', NOW() - INTERVAL '14 days'),
    ('de000000-0000-0000-0000-000000000002', (SELECT id FROM users WHERE email = 'demo@agridemo.com'), 'info', 'Upcoming Visit', 'Scheduled visit with Dalitso Mvula in 3 days.', false, 'in_app', NOW())
ON CONFLICT (id) DO NOTHING;
