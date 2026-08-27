const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

function yieldHistory(avg) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const factors = [0.85, 0.92, 1.0, 1.08, 0.96, 1.05];
  return months.map((month, i) => ({
    month,
    yield: Math.round(avg * factors[i] * 10) / 10,
  }));
}

const DEMO_SEED_FARMERS = [
  {
    id: 'd1000000-0000-0000-0000-000000000001',
    firstName: 'Emmanuel',
    lastName: 'Mwangi',
    phone: '+254712345601',
    location: 'Machakos Rural, Eastern Zone',
    village: 'Kathiani',
    district: 'Machakos',
    region: 'Machakos',
    country: 'Kenya',
    farmSizeHectares: 3.5,
    crops: ['Maize', 'Beans'],
    vitalScore: 62,
    soilMoisture: 42.0,
    temperature: 23.5,
    phLevel: 6.1,
    aiConfidence: 74,
    yieldHistory: yieldHistory(4.2),
    locationLat: -1.5177,
    locationLng: 37.2634,
    languagePreference: 'en',
  },
  {
    id: 'd1000000-0000-0000-0000-000000000002',
    firstName: 'Grace',
    lastName: 'Wanjiku',
    phone: '+254712345602',
    location: 'Kiambu Highlands',
    village: 'Githunguri',
    district: 'Kiambu',
    region: 'Kiambu',
    country: 'Kenya',
    farmSizeHectares: 2.2,
    crops: ['Coffee', 'Maize'],
    vitalScore: 71,
    soilMoisture: 45.5,
    temperature: 21.0,
    phLevel: 5.9,
    aiConfidence: 81,
    yieldHistory: yieldHistory(5.8),
    locationLat: -1.05,
    locationLng: 36.85,
    languagePreference: 'en',
  },
  {
    id: 'd1000000-0000-0000-0000-000000000003',
    firstName: 'David',
    lastName: 'Kiprono',
    phone: '+254712345603',
    location: 'Rift Valley Basin, Nakuru',
    village: 'Njoro',
    district: 'Nakuru',
    region: 'Nakuru',
    country: 'Kenya',
    farmSizeHectares: 5.0,
    crops: ['Potatoes', 'Wheat'],
    vitalScore: 88,
    soilMoisture: 47.0,
    temperature: 19.5,
    phLevel: 6.4,
    aiConfidence: 92,
    yieldHistory: yieldHistory(8.4),
    locationLat: -0.3031,
    locationLng: 36.08,
    languagePreference: 'en',
  },
  {
    id: 'd1000000-0000-0000-0000-000000000004',
    firstName: 'Amina',
    lastName: 'Hassan',
    phone: '+254712345604',
    location: 'Kilifi Coastal Strip',
    village: 'Malindi Sub-County',
    district: 'Kilifi',
    region: 'Kilifi',
    country: 'Kenya',
    farmSizeHectares: 4.1,
    crops: ['Cassava', 'Cashew'],
    vitalScore: 74,
    soilMoisture: 50.5,
    temperature: 28.0,
    phLevel: 6.2,
    aiConfidence: 84,
    yieldHistory: yieldHistory(6.1),
    locationLat: -3.22,
    locationLng: 40.1167,
    languagePreference: 'sw',
  },
  {
    id: 'd1000000-0000-0000-0000-000000000005',
    firstName: 'Samuel',
    lastName: 'Otieno',
    phone: '+254712345605',
    location: 'Lake Basin, Kisumu',
    village: 'Kano Plains',
    district: 'Kisumu',
    region: 'Kisumu',
    country: 'Kenya',
    farmSizeHectares: 1.8,
    crops: ['Rice', 'Sorghum'],
    vitalScore: 58,
    soilMoisture: 55.0,
    temperature: 26.5,
    phLevel: 5.8,
    aiConfidence: 68,
    yieldHistory: yieldHistory(3.9),
    locationLat: -0.0917,
    locationLng: 34.768,
    languagePreference: 'luo',
  },
  {
    id: 'd1000000-0000-0000-0000-000000000006',
    firstName: 'Faith',
    lastName: 'Chebet',
    phone: '+254712345606',
    location: 'Eldoret North Grain Belt',
    village: 'Turbo',
    district: 'Uasin Gishu',
    region: 'Uasin Gishu',
    country: 'Kenya',
    farmSizeHectares: 6.5,
    crops: ['Maize', 'Soybeans'],
    vitalScore: 93,
    soilMoisture: 44.0,
    temperature: 18.0,
    phLevel: 6.6,
    aiConfidence: 95,
    yieldHistory: yieldHistory(9.2),
    locationLat: 0.5143,
    locationLng: 35.2698,
    languagePreference: 'kal',
  },
  {
    id: 'd1000000-0000-0000-0000-000000000007',
    firstName: 'Joseph',
    lastName: 'Mutua',
    phone: '+254712345607',
    location: 'Meru Eastern Slopes',
    village: 'Timau',
    district: 'Meru',
    region: 'Meru',
    country: 'Kenya',
    farmSizeHectares: 2.8,
    crops: ['Tea', 'Avocado'],
    vitalScore: 84,
    soilMoisture: 46.5,
    temperature: 17.5,
    phLevel: 5.6,
    aiConfidence: 90,
    yieldHistory: yieldHistory(7.5),
    locationLat: 0.05,
    locationLng: 37.65,
    languagePreference: 'en',
  },
  {
    id: 'd1000000-0000-0000-0000-000000000008',
    firstName: 'Esther',
    lastName: 'Nyambura',
    phone: '+254712345608',
    location: 'Nyeri Hillside Agro-Forest',
    village: 'Othaya',
    district: 'Nyeri',
    region: 'Nyeri',
    country: 'Kenya',
    farmSizeHectares: 1.5,
    crops: ['Coffee', 'Macadamia'],
    vitalScore: 66,
    soilMoisture: 48.0,
    temperature: 19.0,
    phLevel: 5.7,
    aiConfidence: 77,
    yieldHistory: yieldHistory(4.8),
    locationLat: -0.4167,
    locationLng: 36.95,
    languagePreference: 'en',
  },
  {
    id: 'd1000000-0000-0000-0000-000000000009',
    firstName: 'Brian',
    lastName: 'Wekesa',
    phone: '+254712345609',
    location: 'Trans Nzoia Valley',
    village: 'Endebess',
    district: 'Trans Nzoia',
    region: 'Kitale',
    country: 'Kenya',
    farmSizeHectares: 8.0,
    crops: ['Maize', 'Sunflower'],
    vitalScore: 95,
    soilMoisture: 43.0,
    temperature: 18.5,
    phLevel: 6.5,
    aiConfidence: 96,
    yieldHistory: yieldHistory(11.0),
    locationLat: 1.0167,
    locationLng: 35.0,
    languagePreference: 'en',
  },
  {
    id: 'd1000000-0000-0000-0000-000000000010',
    firstName: 'Lydia',
    lastName: 'Moraa',
    phone: '+254712345610',
    location: 'Kisii Highland Terraces',
    village: 'Suneka',
    district: 'Kisii',
    region: 'Kisii',
    country: 'Kenya',
    farmSizeHectares: 1.2,
    crops: ['Bananas', 'Tea'],
    vitalScore: 68,
    soilMoisture: 51.0,
    temperature: 20.5,
    phLevel: 5.9,
    aiConfidence: 79,
    yieldHistory: yieldHistory(5.1),
    locationLat: -0.6817,
    locationLng: 34.7667,
    languagePreference: 'en',
  },
  {
    id: 'd1000000-0000-0000-0000-000000000011',
    firstName: 'Peter',
    lastName: 'Maina',
    phone: '+254712345611',
    location: 'Muranga Agro Zone',
    village: 'Kangema',
    district: "Murang'a",
    region: 'Muranga',
    country: 'Kenya',
    farmSizeHectares: 3.0,
    crops: ['Avocado', 'Coffee'],
    vitalScore: 79,
    soilMoisture: 46.0,
    temperature: 20.0,
    phLevel: 6.0,
    aiConfidence: 87,
    yieldHistory: yieldHistory(6.8),
    locationLat: -0.7167,
    locationLng: 37.15,
    languagePreference: 'en',
  },
  {
    id: 'd1000000-0000-0000-0000-000000000012',
    firstName: 'Beatrice',
    lastName: 'Cherotich',
    phone: '+254712345612',
    location: 'Bomet South Escarpment',
    village: 'Sotik',
    district: 'Bomet',
    region: 'Bomet',
    country: 'Kenya',
    farmSizeHectares: 4.5,
    crops: ['Tea', 'Dairy Pasture'],
    vitalScore: 82,
    soilMoisture: 45.0,
    temperature: 17.8,
    phLevel: 5.8,
    aiConfidence: 89,
    yieldHistory: yieldHistory(7.2),
    locationLat: -0.7813,
    locationLng: 35.3416,
    languagePreference: 'kal',
  },
];

async function main() {
  console.log('🌱 Starting Prisma DB Seed (seed.cjs)...');
  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. System Administrator
  const admin = await prisma.user.upsert({
    where: { email: 'admin@agridemo.com' },
    update: {
      passwordHash,
      role: 'admin',
    },
    create: {
      email: 'admin@agridemo.com',
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'admin',
      region: 'Global',
    },
  });
  console.log('✅ Admin user verified/seeded:', admin.email);

  // 2. Demo Extension Officer
  const user = await prisma.user.upsert({
    where: { email: 'demo@agridemo.com' },
    update: {
      passwordHash,
    },
    create: {
      email: 'demo@agridemo.com',
      passwordHash,
      firstName: 'Demo',
      lastName: 'User',
      role: 'extension_officer',
      region: 'Kenya',
    },
  });
  console.log('✅ Demo user verified/seeded:', user.email);

  // 3. Regional Managers
  const regionalManagers = [
    { email: 'rm.lilongwe@agridemo.com', firstName: 'Grace', lastName: 'Banda', region: 'Lilongwe' },
    { email: 'rm.kumasi@agridemo.com', firstName: 'Kwame', lastName: 'Asante', region: 'Kumasi' },
    { email: 'rm.lusaka@agridemo.com', firstName: 'Blessing', lastName: 'Zulu', region: 'Lusaka' },
    { email: 'rm.dhaka@agridemo.com', firstName: 'Rahima', lastName: 'Begum', region: 'Dhaka' },
  ];

  for (const rm of regionalManagers) {
    await prisma.user.upsert({
      where: { email: rm.email },
      update: { passwordHash, role: 'regional_manager' },
      create: {
        email: rm.email,
        passwordHash,
        firstName: rm.firstName,
        lastName: rm.lastName,
        role: 'regional_manager',
        region: rm.region,
      },
    });
  }
  console.log('✅ Regional managers seeded');

  // 4. Subscription Plans
  await prisma.subscriptionPlan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {
      stripePriceId: 'price_free',
      features: {
        smsLimit: 0,
        aiChatLimit: 0,
        reportLimit: 0,
        aiVisionLimit: 0,
        speechLimit: 0,
        whatsappLimit: 0,
        knowledgeDailyLimit: 3,
        prioritySupport: false,
        advancedAnalytics: false,
      },
    },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Free',
      description: 'Basic plan for individuals',
      price: 0,
      stripePriceId: 'price_free',
      features: {
        smsLimit: 0,
        aiChatLimit: 0,
        reportLimit: 0,
        aiVisionLimit: 0,
        speechLimit: 0,
        whatsappLimit: 0,
        knowledgeDailyLimit: 3,
        prioritySupport: false,
        advancedAnalytics: false,
      },
    },
  });

  const proPlan = await prisma.subscriptionPlan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {
      stripePriceId: 'price_pro_monthly',
      features: {
        smsLimit: 500,
        aiChatLimit: 1000,
        reportLimit: 50,
        prioritySupport: true,
        advancedAnalytics: true,
      },
    },
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Pro',
      description: 'Advanced features for scaling',
      price: 29.0,
      stripePriceId: 'price_pro_monthly',
      features: {
        smsLimit: 500,
        aiChatLimit: 1000,
        reportLimit: 50,
        prioritySupport: true,
        advancedAnalytics: true,
      },
    },
  });

  await prisma.subscriptionPlan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {
      stripePriceId: 'price_enterprise',
      features: {
        smsLimit: 10000,
        aiChatLimit: 10000,
        reportLimit: 1000,
        prioritySupport: true,
        advancedAnalytics: true,
        customIntegrations: true,
      },
    },
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Enterprise',
      description: 'Full capabilities for large organizations',
      price: 99.0,
      stripePriceId: 'price_enterprise',
      features: {
        smsLimit: 10000,
        aiChatLimit: 10000,
        reportLimit: 1000,
        prioritySupport: true,
        advancedAnalytics: true,
        customIntegrations: true,
      },
    },
  });

  // Assign Pro plan to default user
  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
  });

  if (!existingSubscription) {
    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: proPlan.id,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.usage.create({
      data: {
        subscriptionId: subscription.id,
        smsCount: 12,
        aiChatCount: 5,
        reportCount: 1,
      },
    });
  }

  // 5. Farmers
  for (const seed of DEMO_SEED_FARMERS) {
    await prisma.farmer.upsert({
      where: { id: seed.id },
      update: {
        firstName: seed.firstName,
        lastName: seed.lastName,
        phone: seed.phone,
        location: seed.location,
        village: seed.village,
        district: seed.district,
        region: seed.region,
        country: seed.country,
        farmSizeHectares: seed.farmSizeHectares,
        crops: seed.crops,
        vitalScore: seed.vitalScore,
        soilMoisture: seed.soilMoisture,
        temperature: seed.temperature,
        phLevel: seed.phLevel,
        aiConfidence: seed.aiConfidence,
        yieldHistory: seed.yieldHistory,
        locationLat: seed.locationLat,
        locationLng: seed.locationLng,
        languagePreference: seed.languagePreference,
        assignedOfficerId: user.id,
        isActive: true,
      },
      create: {
        id: seed.id,
        firstName: seed.firstName,
        lastName: seed.lastName,
        phone: seed.phone,
        location: seed.location,
        village: seed.village,
        district: seed.district,
        region: seed.region,
        country: seed.country,
        farmSizeHectares: seed.farmSizeHectares,
        crops: seed.crops,
        vitalScore: seed.vitalScore,
        soilMoisture: seed.soilMoisture,
        temperature: seed.temperature,
        phLevel: seed.phLevel,
        aiConfidence: seed.aiConfidence,
        yieldHistory: seed.yieldHistory,
        locationLat: seed.locationLat,
        locationLng: seed.locationLng,
        languagePreference: seed.languagePreference,
        assignedOfficerId: user.id,
        isActive: true,
      },
    });
  }

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
