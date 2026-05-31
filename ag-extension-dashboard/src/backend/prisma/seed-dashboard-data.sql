-- =============================================================
-- Dashboard Seed Data: Populate all tables for a rich dashboard
-- Run against the remote production/testing database
-- =============================================================

-- 1. SUBSCRIPTION PLANS
-- =============================================================
INSERT INTO subscription_plans (id, name, description, price, currency, interval, features, is_active, created_at, updated_at)
VALUES
    ('aa000000-0000-0000-0000-000000000001', 'Free', 'Basic access for small-scale farmers', 0.00, 'USD', 'month', '["basic_analytics","sms_alerts"]'::jsonb, true, NOW(), NOW()),
    ('aa000000-0000-0000-0000-000000000002', 'Starter', 'For active extension officers', 9.99, 'USD', 'month', '["advanced_analytics","sms_alerts","priority_support","export_reports"]'::jsonb, true, NOW(), NOW()),
    ('aa000000-0000-0000-0000-000000000003', 'Professional', 'For regional managers and organizations', 29.99, 'USD', 'month', '["all_features","api_access","white_label","dedicated_support"]'::jsonb, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. VISITS (rich history across all regions)
-- =============================================================
INSERT INTO visits (id, officer_id, farmer_id, visit_type, status, scheduled_at, started_at, completed_at, duration_minutes, notes, outcomes, follow_up_required, created_at)
VALUES
    ('bb000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'routine', 'completed', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days' + INTERVAL '45 minutes', 45, 'Checked maize growth stage. Soil moisture adequate.', 'Recommended increased spacing for next planting. Soil pH optimal.', true, NOW() - INTERVAL '30 days'),
    ('bb000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002', 'pest_control', 'completed', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days' + INTERVAL '60 minutes', 60, 'Fall armyworm detected in maize field. Applied bio-pesticide.', 'Pest controlled. Farmer trained on early detection signs.', false, NOW() - INTERVAL '25 days'),
    ('bb000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000003', 'soil_testing', 'completed', NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days' + INTERVAL '30 minutes', 30, 'Soil sample collected for lab analysis. pH 6.5, nitrogen low.', 'Recommended legume intercropping to fix nitrogen.', true, NOW() - INTERVAL '20 days'),
    ('bb000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'harvest_review', 'completed', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days' + INTERVAL '50 minutes', 50, 'Maize harvest completed. Yield 2.8 tonnes/hectare.', 'Above average yield. Farmer interested in soybean rotation.', false, NOW() - INTERVAL '10 days'),
    ('bb000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002', 'routine', 'scheduled', NOW() + INTERVAL '3 days', NULL, NULL, NULL, 'Follow-up on pest management. Check new planting.', NULL, false, NOW() - INTERVAL '5 days'),
    ('bb000000-0000-0000-0000-000000000006', 'c2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000004', 'training', 'completed', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days' + INTERVAL '90 minutes', 90, 'Group training on cassava propagation techniques.', '5 farmers attended. Distributed planting material.', true, NOW() - INTERVAL '15 days'),
    ('bc000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000001', 'routine', 'completed', NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days' + INTERVAL '40 minutes', 40, 'Cocoa pod count healthy. Black pod disease spotted on 3 trees.', 'Applied fungicide treatment. Isolation of affected trees.', true, NOW() - INTERVAL '28 days'),
    ('bc000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000003', 'harvest_review', 'completed', NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days' + INTERVAL '55 minutes', 55, 'Cocoa harvest excellent. 1.2 tonnes dried beans.', 'Premium grade achieved. Connected to cooperative buyer.', false, NOW() - INTERVAL '18 days'),
    ('bc000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000002', 'irrigation', 'completed', NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days' + INTERVAL '35 minutes', 35, 'Installed drip irrigation for plantain. Water source adequate.', 'Reduced water usage by 40%. Growth improved.', false, NOW() - INTERVAL '12 days'),
    ('bc000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000004', 'pest_control', 'completed', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days' + INTERVAL '50 minutes', 50, 'Stem borer damage in maize. Applied neem-based pesticide.', 'Organic approach working. Monitor for 2 weeks.', true, NOW() - INTERVAL '8 days'),
    ('bc000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000005', 'routine', 'in_progress', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NULL, NULL, 'Checking cassava growth. Early signs of mosaic virus.', NULL, true, NOW() - INTERVAL '2 days'),
    ('bc000000-0000-0000-0000-000000000006', 'c2000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000005', 'training', 'scheduled', NOW() + INTERVAL '5 days', NULL, NULL, NULL, 'Farmer Field School on integrated pest management.', NULL, false, NOW()),
    ('bd000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000005', 'f3000000-0000-0000-0000-000000000001', 'routine', 'completed', NOW() - INTERVAL '22 days', NOW() - INTERVAL '22 days', NOW() - INTERVAL '22 days' + INTERVAL '40 minutes', 40, 'Soybean growth on track. Nodulation good.', 'No intervention needed. Continue current practice.', false, NOW() - INTERVAL '22 days'),
    ('bd000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000005', 'f3000000-0000-0000-0000-000000000002', 'market_linkage', 'completed', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days' + INTERVAL '60 minutes', 60, 'Connected farmer to Lusaka wholesale market for tomatoes.', 'Secured weekly supply contract at premium price.', false, NOW() - INTERVAL '14 days'),
    ('bd000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000005', 'f3000000-0000-0000-0000-000000000003', 'soil_testing', 'completed', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days' + INTERVAL '25 minutes', 25, 'Soil pH 6.5, good structure. Phosphorus slightly low.', 'Recommended TSP fertilizer application at 50kg/ha.', true, NOW() - INTERVAL '7 days'),
    ('bd000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000006', 'f3000000-0000-0000-0000-000000000004', 'routine', 'completed', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '30 minutes', 30, 'Wheat at heading stage. Minor rust symptoms.', 'Applied fungicide. Will reassess in 10 days.', true, NOW() - INTERVAL '5 days'),
    ('bd000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000006', 'f3000000-0000-0000-0000-000000000005', 'training', 'scheduled', NOW() + INTERVAL '7 days', NULL, NULL, NULL, 'Vegetable production training for women group.', NULL, false, NOW()),
    ('be000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000007', 'f4000000-0000-0000-0000-000000000001', 'routine', 'completed', NOW() - INTERVAL '26 days', NOW() - INTERVAL '26 days', NOW() - INTERVAL '26 days' + INTERVAL '35 minutes', 35, 'Rice seedling transplanted. Water level management critical.', 'Installed simple water gauge. Farmer trained on readings.', false, NOW() - INTERVAL '26 days'),
    ('be000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000007', 'f4000000-0000-0000-0000-000000000002', 'irrigation', 'completed', NOW() - INTERVAL '16 days', NOW() - INTERVAL '16 days', NOW() - INTERVAL '16 days' + INTERVAL '50 minutes', 50, 'Checked wheat irrigation schedule. Adjusted timing.', 'Water savings of 25%. Crop stress reduced.', false, NOW() - INTERVAL '16 days'),
    ('be000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000007', 'f4000000-0000-0000-0000-000000000003', 'harvest_review', 'completed', NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days' + INTERVAL '40 minutes', 40, 'Chili harvest below expected. Possible nutrient deficiency.', 'Soil test recommended. Foliar spray applied as immediate fix.', true, NOW() - INTERVAL '9 days'),
    ('be000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000008', 'f4000000-0000-0000-0000-000000000004', 'aquaculture', 'completed', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days' + INTERVAL '70 minutes', 70, 'Fish pond water quality tested. pH 6.8, dissolved oxygen adequate.', 'Stocked 500 fingerlings. Feed schedule adjusted.', false, NOW() - INTERVAL '4 days'),
    ('be000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000008', 'f4000000-0000-0000-0000-000000000005', 'routine', 'scheduled', NOW() + INTERVAL '2 days', NULL, NULL, NULL, 'Rice flowering stage check. Pest monitoring.', NULL, false, NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. SMS HISTORY
-- =============================================================
INSERT INTO sms_history (id, sender_id, recipient_phone, farmer_id, message, status, provider, created_at)
VALUES
    ('cc000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', '+265882000001', 'f1000000-0000-0000-0000-000000000001', 'Reminder: Your maize field visit is scheduled for tomorrow at 9AM. Please ensure access to the field.', 'delivered', 'twilio', NOW() - INTERVAL '31 days'),
    ('cc000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', '+265882000002', 'f1000000-0000-0000-0000-000000000002', 'ALERT: Fall armyworm detected in your region. Inspect your maize fields immediately. Call your extension officer for help.', 'delivered', 'twilio', NOW() - INTERVAL '25 days'),
    ('cc000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000001', '+265882000003', 'f1000000-0000-0000-0000-000000000003', 'Soil test results ready. Your soil pH is 6.5 - good for soybean. Nitrogen is low, consider legume rotation.', 'delivered', 'twilio', NOW() - INTERVAL '19 days'),
    ('cc000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000003', '+233202000001', 'f2000000-0000-0000-0000-000000000001', 'Weather alert: Heavy rains expected next 3 days. Ensure drainage in cocoa plantations. Black pod risk HIGH.', 'delivered', 'twilio', NOW() - INTERVAL '20 days'),
    ('cc000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000003', '+233202000003', 'f2000000-0000-0000-0000-000000000003', 'Great news! Your cocoa has been graded as Premium. Cooperative buyer confirmed pickup on Friday.', 'delivered', 'twilio', NOW() - INTERVAL '17 days'),
    ('cc000000-0000-0000-0000-000000000006', 'c2000000-0000-0000-0000-000000000005', '+260952000001', 'f3000000-0000-0000-0000-000000000001', 'Soybean prices up 15% at Lusaka market. Consider timing your harvest for maximum profit.', 'delivered', 'twilio', NOW() - INTERVAL '13 days'),
    ('cc000000-0000-0000-0000-000000000007', 'c2000000-0000-0000-0000-000000000005', '+260952000002', 'f3000000-0000-0000-0000-000000000002', 'Market update: Tomato demand high. Your weekly delivery confirmed at K150/kg. Keep quality standards.', 'delivered', 'twilio', NOW() - INTERVAL '11 days'),
    ('cc000000-0000-0000-0000-000000000008', 'c2000000-0000-0000-0000-000000000007', '+880172000001', 'f4000000-0000-0000-0000-000000000001', 'Rice cultivation tip: Maintain 5cm water level during tillering stage. Your field is at 3cm - increase irrigation.', 'delivered', 'twilio', NOW() - INTERVAL '24 days'),
    ('cc000000-0000-0000-0000-000000000009', 'c2000000-0000-0000-0000-000000000007', '+880172000002', 'f4000000-0000-0000-0000-000000000002', 'Wheat rust alert in your area. Scout your fields today. Early fungicide application saves 30% yield.', 'delivered', 'twilio', NOW() - INTERVAL '14 days'),
    ('cc000000-0000-0000-0000-000000000010', 'c2000000-0000-0000-0000-000000000008', '+880172000004', 'f4000000-0000-0000-0000-000000000004', 'Fish feeding reminder: Increase feed to 3% body weight as fingerlings grow. Check water clarity daily.', 'delivered', 'twilio', NOW() - INTERVAL '3 days'),
    ('cc000000-0000-0000-0000-000000000011', 'c2000000-0000-0000-0000-000000000001', '+265882000005', 'f1000000-0000-0000-0000-000000000005', 'Training reminder: Cassava propagation workshop next Tuesday at Kawale Community Center. Bring cuttings.', 'sent', 'twilio', NOW() - INTERVAL '5 days'),
    ('cc000000-0000-0000-0000-000000000012', 'c2000000-0000-0000-0000-000000000004', '+233202000005', 'f2000000-0000-0000-0000-000000000005', 'Cassava mosaic disease detected nearby. Inspect your plants. Remove and burn any infected cuttings immediately.', 'delivered', 'twilio', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

-- 4. NOTIFICATIONS (schema: user_id, type, title, message, is_read, channel, metadata)
-- =============================================================
INSERT INTO notifications (id, user_id, type, title, message, is_read, channel, created_at)
VALUES
    ('dd000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'success', 'Visit Completed', 'You completed a visit with Joseph Mkandawire - maize harvest review.', true, 'in_app', NOW() - INTERVAL '10 days'),
    ('dd000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', 'warning', 'Pest Alert', 'Fall armyworm reported in Lilongwe district. Check assigned farmers.', true, 'in_app', NOW() - INTERVAL '25 days'),
    ('dd000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000001', 'info', 'Upcoming Visit', 'Follow-up visit with Agnes Kamanga scheduled in 3 days.', false, 'in_app', NOW() - INTERVAL '1 day'),
    ('dd000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000003', 'success', 'Harvest Report', 'Yaw Frimpong achieved premium cocoa grade. 1.2 tonnes harvested.', true, 'in_app', NOW() - INTERVAL '17 days'),
    ('dd000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000003', 'warning', 'Weather Warning', 'Heavy rains expected in Kumasi. Alert cocoa farmers about black pod risk.', true, 'in_app', NOW() - INTERVAL '20 days'),
    ('dd000000-0000-0000-0000-000000000006', 'c2000000-0000-0000-0000-000000000003', 'info', 'Training Scheduled', 'Farmer Field School on IPM scheduled for next week. 12 farmers registered.', false, 'in_app', NOW()),
    ('dd000000-0000-0000-0000-000000000007', 'c2000000-0000-0000-0000-000000000005', 'info', 'Market Price Update', 'Soybean prices up 15% at Lusaka market. Inform farmers.', true, 'in_app', NOW() - INTERVAL '13 days'),
    ('dd000000-0000-0000-0000-000000000008', 'c2000000-0000-0000-0000-000000000005', 'info', 'Soil Test Ready', 'Soil analysis results for Gift Phiri field available. Phosphorus low.', false, 'in_app', NOW() - INTERVAL '6 days'),
    ('dd000000-0000-0000-0000-000000000009', 'c2000000-0000-0000-0000-000000000007', 'warning', 'Irrigation Check', 'Rice water level below threshold for Nasrin Rahman field.', true, 'in_app', NOW() - INTERVAL '24 days'),
    ('dd000000-0000-0000-0000-000000000010', 'c2000000-0000-0000-0000-000000000007', 'error', 'Rust Alert', 'Wheat rust detected in Dhaka region. Scout assigned farmers.', false, 'in_app', NOW() - INTERVAL '14 days'),
    ('dd000000-0000-0000-0000-000000000011', 'b1000000-0000-0000-0000-000000000001', 'info', 'Weekly Summary', 'Lilongwe region: 6 visits completed, 2 scheduled. 1 pest alert resolved.', false, 'in_app', NOW() - INTERVAL '1 day'),
    ('dd000000-0000-0000-0000-000000000012', 'b1000000-0000-0000-0000-000000000002', 'info', 'Weekly Summary', 'Kumasi region: 5 visits completed, 1 in progress. Premium cocoa achieved.', false, 'in_app', NOW() - INTERVAL '1 day'),
    ('dd000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'success', 'System Update', 'New disease diagnosis AI model deployed. Accuracy improved to 94%.', false, 'in_app', NOW() - INTERVAL '3 days'),
    ('dd000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', 'info', 'User Growth', '15 new farmers registered this week across all regions.', false, 'in_app', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

-- 5. ALERTS (schema: type, severity, title, description, location, is_active, triggered_at, resolved_at)
-- =============================================================
INSERT INTO alerts (id, type, severity, title, description, location, is_active, triggered_at, resolved_at, created_at)
VALUES
    ('ee000000-0000-0000-0000-000000000001', 'pest', 'high', 'Fall Armyworm Outbreak', 'Fall armyworm detected in Lilongwe district. 3 farms affected. Bio-pesticide distribution initiated.', 'Lilongwe', false, NOW() - INTERVAL '25 days', NOW() - INTERVAL '22 days', NOW() - INTERVAL '25 days'),
    ('ee000000-0000-0000-0000-000000000002', 'weather', 'medium', 'Heavy Rainfall Warning', 'Heavy rains expected in Kumasi region for 3 days. Risk of black pod disease in cocoa plantations.', 'Kumasi', false, NOW() - INTERVAL '20 days', NOW() - INTERVAL '17 days', NOW() - INTERVAL '20 days'),
    ('ee000000-0000-0000-0000-000000000003', 'disease', 'high', 'Cassava Mosaic Disease', 'Cassava mosaic virus detected in Suame area. 2 farms affected. Quarantine recommended.', 'Kumasi', true, NOW() - INTERVAL '2 days', NULL, NOW() - INTERVAL '2 days'),
    ('ee000000-0000-0000-0000-000000000004', 'disease', 'medium', 'Wheat Rust Alert', 'Wheat rust symptoms reported in Dhaka region. Early fungicide application recommended.', 'Dhaka', true, NOW() - INTERVAL '14 days', NULL, NOW() - INTERVAL '14 days'),
    ('ee000000-0000-0000-0000-000000000005', 'market', 'low', 'Soybean Price Surge', 'Soybean prices increased 15% at Lusaka market. Good opportunity for farmers with harvest-ready crops.', 'Lusaka', false, NOW() - INTERVAL '13 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '13 days'),
    ('ee000000-0000-0000-0000-000000000006', 'weather', 'low', 'Dry Spell Forecast', 'No rainfall expected in Lilongwe for 10 days. Monitor soil moisture levels.', 'Lilongwe', true, NOW() - INTERVAL '5 days', NULL, NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;

-- 6. MARKET PRICES (schema: crop, price (varchar), trend (varchar))
-- =============================================================
INSERT INTO market_prices (id, crop, price, trend, updated_at)
VALUES
    ('ff000000-0000-0000-0000-000000000001', 'Maize', 'MWK 350/kg', 'stable', NOW() - INTERVAL '7 days'),
    ('ff000000-0000-0000-0000-000000000002', 'Soybean', 'MWK 520/kg', 'up', NOW() - INTERVAL '7 days'),
    ('ff000000-0000-0000-0000-000000000003', 'Groundnuts', 'MWK 850/kg', 'up', NOW() - INTERVAL '7 days'),
    ('ff000000-0000-0000-0000-000000000004', 'Cocoa', 'GHC 12.50/kg', 'up', NOW() - INTERVAL '5 days'),
    ('ff000000-0000-0000-0000-000000000005', 'Cassava', 'GHC 450/kg', 'stable', NOW() - INTERVAL '5 days'),
    ('ff000000-0000-0000-0000-000000000006', 'Plantain', 'GHC 600/bunch', 'down', NOW() - INTERVAL '5 days'),
    ('ff000000-0000-0000-0000-000000000007', 'Maize', 'ZMW 2.80/kg', 'stable', NOW() - INTERVAL '3 days'),
    ('ff000000-0000-0000-0000-000000000008', 'Tomatoes', 'ZMW 4.50/kg', 'up', NOW() - INTERVAL '3 days'),
    ('ff000000-0000-0000-0000-000000000009', 'Wheat', 'ZMW 3.20/kg', 'down', NOW() - INTERVAL '3 days'),
    ('ff000000-0000-0000-0000-000000000010', 'Rice', 'BDT 45/kg', 'stable', NOW() - INTERVAL '4 days'),
    ('ff000000-0000-0000-0000-000000000011', 'Jute', 'BDT 35/kg', 'down', NOW() - INTERVAL '4 days'),
    ('ff000000-0000-0000-0000-000000000012', 'Chili', 'BDT 80/kg', 'up', NOW() - INTERVAL '4 days')
ON CONFLICT (id) DO NOTHING;

-- 7. REPORTS
-- =============================================================
INSERT INTO reports (id, type, title, content, generated_by, status, created_at)
VALUES
    ('ab000000-0000-0000-0000-000000000001', 'monthly', 'Lilongwe Monthly Report - May 2026', '{"totalVisits": 6, "completedVisits": 5, "farmersVisited": 5, "pestAlerts": 1, "avgVitalScore": 77.0, "topCrops": ["maize", "groundnuts", "soybean"]}'::jsonb, 'c2000000-0000-0000-0000-000000000001', 'submitted', NOW() - INTERVAL '2 days'),
    ('ab000000-0000-0000-0000-000000000002', 'monthly', 'Kumasi Monthly Report - May 2026', '{"totalVisits": 6, "completedVisits": 5, "farmersVisited": 5, "premiumGrades": 1, "avgVitalScore": 70.1, "topCrops": ["cocoa", "cassava", "maize"]}'::jsonb, 'c2000000-0000-0000-0000-000000000003', 'submitted', NOW() - INTERVAL '2 days'),
    ('ab000000-0000-0000-0000-000000000003', 'monthly', 'Lusaka Monthly Report - May 2026', '{"totalVisits": 5, "completedVisits": 4, "farmersVisited": 5, "marketLinks": 1, "avgVitalScore": 74.6, "topCrops": ["maize", "soybean", "vegetables"]}'::jsonb, 'c2000000-0000-0000-0000-000000000005', 'submitted', NOW() - INTERVAL '2 days'),
    ('ab000000-0000-0000-0000-000000000004', 'monthly', 'Dhaka Monthly Report - May 2026', '{"totalVisits": 5, "completedVisits": 4, "farmersVisited": 5, "irrigationIssues": 2, "avgVitalScore": 69.6, "topCrops": ["rice", "wheat", "jute"]}'::jsonb, 'c2000000-0000-0000-0000-000000000007', 'submitted', NOW() - INTERVAL '2 days'),
    ('ab000000-0000-0000-0000-000000000005', 'quarterly', 'Q2 2026 Regional Summary', '{"regions": ["Lilongwe", "Kumasi", "Lusaka", "Dhaka"], "totalVisits": 22, "totalFarmers": 20, "overallVitalScore": 72.8, "emergingIssues": ["fall armyworm", "cassava mosaic", "wheat rust"]}'::jsonb, 'a0000000-0000-0000-0000-000000000001', 'published', NOW() - INTERVAL '1 day'),
    ('ab000000-0000-0000-0000-000000000006', 'farmer', 'Farmer Health Report - Temwa Ngwira', '{"vitalScore": 88.3, "soilMoisture": 48.5, "temperature": 27.0, "phLevel": 6.8, "aiConfidence": 92, "recommendations": ["Continue tobacco-maize rotation", "Consider adding groundnuts for nitrogen fixation"]}'::jsonb, 'c2000000-0000-0000-0000-000000000001', 'draft', NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;

-- 8. ANALYTICS EVENTS
-- =============================================================
INSERT INTO analytics_events (id, event_type, user_id, farmer_id, metadata, created_at)
VALUES
    ('ac000000-0000-0000-0000-000000000001', 'visit_completed', 'c2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', '{"visitType": "routine", "duration": 45}'::jsonb, NOW() - INTERVAL '30 days'),
    ('ac000000-0000-0000-0000-000000000002', 'pest_alert', 'c2000000-0000-0000-0000-000000000001', NULL, '{"pest": "fall armyworm", "severity": "high"}'::jsonb, NOW() - INTERVAL '25 days'),
    ('ac000000-0000-0000-0000-000000000003', 'harvest_report', 'c2000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000003', '{"crop": "cocoa", "yield": 1.2, "grade": "premium"}'::jsonb, NOW() - INTERVAL '18 days'),
    ('ac000000-0000-0000-0000-000000000004', 'market_linkage', 'c2000000-0000-0000-0000-000000000005', 'f3000000-0000-0000-0000-000000000002', '{"crop": "tomatoes", "price": 150, "unit": "ZMW/kg"}'::jsonb, NOW() - INTERVAL '14 days'),
    ('ac000000-0000-0000-0000-000000000005', 'disease_detected', 'c2000000-0000-0000-0000-000000000003', NULL, '{"disease": "cassava mosaic", "affectedFarms": 2}'::jsonb, NOW() - INTERVAL '2 days'),
    ('ac000000-0000-0000-0000-000000000006', 'training_completed', 'c2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000004', '{"topic": "cassava propagation", "attendees": 5}'::jsonb, NOW() - INTERVAL '15 days'),
    ('ac000000-0000-0000-0000-000000000007', 'visit_completed', 'c2000000-0000-0000-0000-000000000008', 'f4000000-0000-0000-0000-000000000004', '{"visitType": "aquaculture", "duration": 70}'::jsonb, NOW() - INTERVAL '4 days')
ON CONFLICT (id) DO NOTHING;

-- 9. KNOWLEDGE ARTICLES (only if table is empty)
-- =============================================================
INSERT INTO knowledge_articles (id, title, content, content_type, summary, category, tags, crops, regions, source)
SELECT v.id::uuid, v.title, v.content, v.content_type, v.summary, v.category, v.tags, v.crops, v.regions, v.source FROM (VALUES
    ('ad000000-0000-0000-0000-000000000001', 'Fall Armyworm Management Guide', 'Comprehensive guide on identifying and managing fall armyworm in maize fields. Early detection is key to preventing crop loss. Look for window-pane damage on leaves, frass near the whorl, and small larvae inside the plant. Use push-pull technology with Napier grass and Desmodium as intercrop. Apply Bacillus thuringiensis (Bt) based biopesticides at early stages. Chemical control with emamectin benzoate is effective but use as last resort.', 'text', 'Guide for identifying and managing fall armyworm in maize using integrated pest management.', 'pest_management', ARRAY['fall armyworm', 'maize', 'pest control', 'IPM'], ARRAY['maize'], ARRAY['Lilongwe', 'Kumasi', 'Lusaka'], 'Ag-Extension Research'),
    ('ad000000-0000-0000-0000-000000000002', 'Soil Health Assessment Protocol', 'Step-by-step protocol for on-farm soil health assessment. Collect samples from 15cm depth at 5 points across the field. Mix thoroughly and take 500g sub-sample. Test pH with field kit (target 6.0-7.0 for most crops). Check for earthworm presence as indicator of biological activity. Assess soil structure by squeezing - should form a ball that crumbles easily. Organic matter should be above 3% for good water retention.', 'text', 'Protocol for on-farm soil health assessment including pH, nutrients, and organic matter.', 'soil_management', ARRAY['soil', 'testing', 'nutrients', 'pH'], ARRAY['maize', 'soybean', 'cassava'], ARRAY['Lilongwe', 'Lusaka', 'Dhaka'], 'Ag-Extension Research'),
    ('ad000000-0000-0000-0000-000000000003', 'Cocoa Black Pod Disease Prevention', 'Black pod disease caused by Phytophthora spp. is the most damaging cocoa disease. Prevention: maintain 30% shade cover, prune lower branches for air circulation, remove infected pods immediately and bury them. Apply copper-based fungicide during rainy season. Harvest mature pods within 2 weeks. Keep pod heaps covered and away from tree trunks. Sanitation is more effective than chemical control.', 'text', 'Prevention and treatment strategies for cocoa black pod disease.', 'disease_management', ARRAY['cocoa', 'black pod', 'fungicide', 'Phytophthora'], ARRAY['cocoa'], ARRAY['Kumasi'], 'Cocoa Research Institute'),
    ('ad000000-0000-0000-0000-000000000004', 'Water-Smart Irrigation for Smallholders', 'Modern irrigation techniques for smallholder farmers. Drip irrigation reduces water use by 40-60% compared to flood. Use mulching with crop residues to reduce evaporation. Water early morning (6-8am) to minimize losses. Schedule irrigation based on crop stage: seedlings need frequent light watering, flowering stage needs consistent moisture. Install simple tensiometer for soil moisture monitoring.', 'text', 'Modern irrigation techniques for water efficiency in smallholder farming.', 'irrigation', ARRAY['water', 'irrigation', 'drip', 'efficiency', 'mulching'], ARRAY['rice', 'vegetables', 'wheat'], ARRAY['Dhaka', 'Lusaka'], 'Ag-Extension Research'),
    ('ad000000-0000-0000-0000-000000000005', 'Market Access for Smallholder Farmers', 'How to access premium markets and get fair prices. Form or join a farmer cooperative for bulk selling power. Grade and sort produce before sale - premium grade earns 20-30% more. Build relationships with 2-3 buyers to avoid dependence. Use mobile price apps to check daily market rates. Consider contract farming for guaranteed prices. Store produce properly to sell during off-season when prices are higher.', 'text', 'Strategies for smallholder farmers to access premium markets and improve pricing.', 'marketing', ARRAY['market', 'cooperative', 'pricing', 'sales', 'grading'], ARRAY['cocoa', 'tomatoes', 'maize', 'rice'], ARRAY['Lilongwe', 'Kumasi', 'Lusaka', 'Dhaka'], 'Ag-Extension Research')
) AS v(id, title, content, content_type, summary, category, tags, crops, regions, source)
WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles LIMIT 1);
