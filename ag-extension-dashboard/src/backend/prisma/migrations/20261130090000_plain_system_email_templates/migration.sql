-- The built-in email templates were seeded with emoji and title-case subjects. Rewrite
-- them in plain sentence case, but only where the text is still the untouched default:
-- a template someone has edited is theirs and stays as it is.
UPDATE email_templates SET subject = '{{diseaseName}} alert for {{region}}'
 WHERE created_by = 'system' AND subject = '⚠️ {{diseaseName}} Alert - {{region}} Region';
UPDATE email_templates SET body = replace(body, 'URGENT AGRICULTURAL ALERT', 'Disease alert')
 WHERE created_by = 'system' AND name = 'disease_alert_notification' AND body LIKE 'URGENT AGRICULTURAL ALERT%';
UPDATE email_templates SET subject = 'Farm visit confirmed: {{farmerName}} on {{visitDate}}'
 WHERE created_by = 'system' AND subject = 'Farm Visit Confirmed - {{farmerName}} on {{visitDate}}';
UPDATE email_templates SET subject = 'Market price update: {{cropName}} at {{price}}/{{unit}}'
 WHERE created_by = 'system' AND subject = 'Market Price Update - {{cropName}} at {{price}}/{{unit}}';
UPDATE email_templates SET subject = 'Weather advisory: {{region}} ({{dateRange}})'
 WHERE created_by = 'system' AND subject = 'Weather Advisory - {{region}} ({{dateRange}})';
UPDATE email_templates SET subject = 'Training invitation: {{trainingTopic}} on {{date}}'
 WHERE created_by = 'system' AND subject = 'Training Invitation: {{trainingTopic}} on {{date}}';
