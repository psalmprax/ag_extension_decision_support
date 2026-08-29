import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { DEMO_SEED_FARMERS } from './demoFarmers';

dotenv.config();

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  // Users
  // 1. System Administrator
  await prisma.user.upsert({
    where: { email: 'admin@agridemo.com' },
    update: {
      passwordHash,
      role: 'admin',
      isDemo: true,
    },
    create: {
      email: 'admin@agridemo.com',
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'admin',
      region: 'Global',
      isDemo: true,
    },
  });

  // 2. Demo Extension Officer
  const user = await prisma.user.upsert({
    where: { email: 'demo@agridemo.com' },
    update: {
      passwordHash,
      isDemo: true,
    },
    create: {
      email: 'demo@agridemo.com',
      passwordHash,
      firstName: 'Demo',
      lastName: 'User',
      role: 'extension_officer',
      region: 'Kenya',
      isDemo: true,
    },
  });

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
      update: { passwordHash, role: 'regional_manager', isDemo: true },
      create: {
        email: rm.email,
        passwordHash,
        firstName: rm.firstName,
        lastName: rm.lastName,
        role: 'regional_manager',
        region: rm.region,
        isDemo: true,
      },
    });
  }

  // Subscription Plans
  const freePlan = await prisma.subscriptionPlan.upsert({
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
        advancedAnalytics: false
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
        advancedAnalytics: false
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
        advancedAnalytics: true
      },
    },
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Pro',
      description: 'Advanced features for scaling',
      price: 29.00,
      stripePriceId: 'price_pro_monthly',
      features: {
        smsLimit: 500,
        aiChatLimit: 1000,
        reportLimit: 50,
        prioritySupport: true,
        advancedAnalytics: true
      },
    },
  });

  const enterprisePlan = await prisma.subscriptionPlan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {
      stripePriceId: 'price_enterprise',
      features: {
        smsLimit: 10000,
        aiChatLimit: 10000,
        reportLimit: 1000,
        prioritySupport: true,
        advancedAnalytics: true,
        customIntegrations: true
      },
    },
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Enterprise',
      description: 'Full capabilities for large organizations',
      price: 99.00,
      stripePriceId: 'price_enterprise',
      features: {
        smsLimit: 10000,
        aiChatLimit: 10000,
        reportLimit: 1000,
        prioritySupport: true,
        advancedAnalytics: true,
        customIntegrations: true
      },
    },
  });

  // Assign Pro plan to the default user if they don't have a subscription
  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId: user.id }
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

    // Initial Usage
    await prisma.usage.create({
      data: {
        subscriptionId: subscription.id,
        smsCount: 12,
        aiChatCount: 5,
        reportCount: 1,
      },
    });
  }

  // Farmers — canonical demo dataset (12 Kenyan farmers matching the frontend
  // DEMO_FARMERS). Upsert by fixed UUID so this converges regardless of whether
  // `fix-demo-user.sql` or this Prisma seed ran first. Assigned to the demo
  // officer so the live /analytics/dashboard aggregation returns the same
  // counts, regions and crop distribution as the static demo.
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
        isDemo: true,
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
        isDemo: true,
      },
    });
  }

  const farmer1 = DEMO_SEED_FARMERS[0];
  const farmer2 = DEMO_SEED_FARMERS[1];

  // Fields (only when empty)
  const fieldCount = await prisma.field.count();
  if (fieldCount === 0) {
    const field1 = await prisma.field.create({
      data: {
        farmerId: farmer1.id,
        name: 'North Plot',
        areaHectares: 2.5,
        soilType: 'Loam',
        soilPh: 6.5
      }
    });

    const field2 = await prisma.field.create({
      data: {
        farmerId: farmer2.id,
        name: 'Valley Farm',
        areaHectares: 1.8,
        soilType: 'Clay',
        soilPh: 5.8
      }
    });

    // Crop Cycles
    await prisma.cropCycle.create({
      data: {
        fieldId: field1.id,
        cropName: 'Maize',
        status: 'growing',
        plantingDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      }
    });

    await prisma.cropCycle.create({
      data: {
        fieldId: field2.id,
        cropName: 'Coffee',
        status: 'harvested',
        plantingDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
        actualHarvestDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        yieldKg: 1500
      }
    });
  }

  // Visits (only when empty)
  const visitCount = await prisma.visit.count();
  if (visitCount === 0) {
    await prisma.visit.create({
      data: {
        officerId: user.id,
        farmerId: farmer1.id,
        visitType: 'routine',
        status: 'completed',
        scheduledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        notes: 'Crop looking healthy, advised on fertilizer.'
      }
    });

    await prisma.visit.create({
      data: {
        officerId: user.id,
        farmerId: farmer2.id,
        visitType: 'emergency',
        status: 'scheduled',
        scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        notes: 'Check for leaf rust.'
      }
    });
  }

  // Alerts (only when empty)
  const alertCount = await prisma.alert.count();
  if (alertCount === 0) {
    await prisma.alert.create({
      data: {
        type: 'weather',
        severity: 'high',
        title: 'Heavy Rainfall Warning',
        description: 'Expected heavy rainfall in the Central region over the next 48 hours.',
        location: 'Kenya',
        affectedFarmers: [farmer1.id, farmer2.id]
      }
    });
  }

  // Reports (only when empty)
  const reportCount = await prisma.report.count();
  if (reportCount === 0) {
    await prisma.report.create({
      data: {
        type: 'monthly_summary',
        title: 'Monthly Extension Report - June',
        content: { summary: 'Completed 15 visits, identified 2 outbreaks.' },
        generatedBy: user.id,
        status: 'published'
      }
    });
  }

  console.log('Seeding completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
