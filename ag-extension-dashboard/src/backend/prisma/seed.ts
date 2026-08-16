import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  // Users
  const user = await prisma.user.upsert({
    where: { email: 'demo@agridemo.com' },
    update: {},
    create: {
      email: 'demo@agridemo.com',
      passwordHash,
      firstName: 'Demo',
      lastName: 'User',
      role: 'extension_officer',
      region: 'Central',
    },
  });

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

  // Farmers
  const farmerCount = await prisma.farmer.count();
  if (farmerCount === 0) {
    const farmer1 = await prisma.farmer.create({
      data: {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+254700111222',
        region: 'Central',
        village: 'Village A',
        crops: ['Corn', 'Wheat'],
        userId: user.id,
        vitalScore: 82,
        yieldHistory: [
          { month: 'Jan', yield: 45 },
          { month: 'Feb', yield: 52 },
          { month: 'Mar', yield: 48 },
          { month: 'Apr', yield: 61 },
          { month: 'May', yield: 55 },
          { month: 'Jun', yield: 67 },
        ]
      }
    });

    const farmer2 = await prisma.farmer.create({
      data: {
        firstName: 'Peter',
        lastName: 'Kamau',
        phone: '+254700222333',
        region: 'Central',
        village: 'Village B',
        crops: ['Coffee', 'Tea'],
        userId: user.id,
        vitalScore: 65,
        yieldHistory: [
          { month: 'Jan', yield: 38 },
          { month: 'Feb', yield: 42 },
          { month: 'Mar', yield: 40 },
          { month: 'Apr', yield: 45 },
          { month: 'May', yield: 48 },
          { month: 'Jun', yield: 50 },
        ]
      }
    });

    // Fields
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
            cropName: 'Corn',
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

    // Visits
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

    // Alerts
    await prisma.alert.create({
        data: {
            type: 'weather',
            severity: 'high',
            title: 'Heavy Rainfall Warning',
            description: 'Expected heavy rainfall in the Central region over the next 48 hours.',
            location: 'Central',
            affectedFarmers: [farmer1.id, farmer2.id]
        }
    });

    // Reports
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
