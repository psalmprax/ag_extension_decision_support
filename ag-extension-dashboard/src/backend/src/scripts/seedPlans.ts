import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  console.log('Seeding subscription plans...');

  const plans = [
    {
      name: 'Free',
      description: 'Perfect for getting started. Basic features and limited usage.',
      price: 0,
      currency: 'USD',
      interval: 'month',
      features: {
        smsLimit: 0,
        aiChatLimit: 0,
        reportLimit: 0,
        aiVisionLimit: 0,
        speechLimit: 0,
        whatsappLimit: 0,
        knowledgeDailyLimit: 3,
        support: 'Community',
        pwa: true,
        weather: true,
      },
    },
    {
      name: 'Pro',
      description: 'Unlock full potential with increased limits and priority features.',
      price: 29.0,
      currency: 'USD',
      interval: 'month',
      stripePriceId: process.env.STRIPE_PRO_PRICE_ID || undefined,
      features: {
        smsLimit: 100,
        aiChatLimit: 500,
        reportLimit: 15,
        support: 'Priority Email',
        pwa: true,
        weather: true,
        analytics: true,
      },
    },
    {
      name: 'Enterprise',
      description: 'Unlimited access and dedicated support for organizations.',
      price: 99.0,
      currency: 'USD',
      interval: 'month',
      stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || undefined,
      features: {
        smsLimit: -1, // Unlimited
        aiChatLimit: -1,
        reportLimit: -1,
        support: '24/7 Phone & Email',
        pwa: true,
        weather: true,
        analytics: true,
        customReports: true,
      },
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { id: (await prisma.subscriptionPlan.findFirst({ where: { name: plan.name } }))?.id || '00000000-0000-0000-0000-000000000000' },
      update: plan,
      create: plan,
    });
    console.log(`- Seeded ${plan.name} plan`);
  }

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
