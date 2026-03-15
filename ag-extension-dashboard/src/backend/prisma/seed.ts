import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  // Users
  const user = await prisma.user.upsert({
    where: { email: 'officer@ag-extension.org' },
    update: {},
    create: {
      email: 'officer@ag-extension.org',
      passwordHash,
      firstName: 'John',
      lastName: 'Doe',
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
        smsLimit: 50,
        aiChatLimit: 20,
        reportLimit: 5,
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
        smsLimit: 50,
        aiChatLimit: 20,
        reportLimit: 5,
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
    await prisma.farmer.createMany({
      data: [
        {
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+254700111222',
          region: 'Central',
          village: 'Village A',
          crops: ['Corn', 'Wheat'],
          userId: user.id,
        },
        {
          firstName: 'Peter',
          lastName: 'Kamau',
          phone: '+254700222333',
          region: 'Central',
          village: 'Village B',
          crops: ['Coffee', 'Tea'],
          userId: user.id,
        }
      ]
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
