const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function setupDemo() {
  try {
    console.log('Setting up demo account...');

    // Create demo user
    const hashedPassword = await bcrypt.hash('demo123', 12);
    
    const user = await prisma.user.upsert({
      where: { email: 'demo@securedapi.com' },
      update: {},
      create: {
        email: 'demo@securedapi.com',
        password: hashedPassword,
        name: 'Demo User',
        tier: 'FREE'
      }
    });

    console.log('✓ Demo user created:', user.email);

    // Create demo API key
    const key = `sk_${crypto.randomBytes(32).toString('hex')}`;
    const siteKey = 'demo-site-key';
    const secretKey = `secret_${crypto.randomBytes(32).toString('hex')}`;

    const apiKey = await prisma.apiKey.upsert({
      where: { siteKey: siteKey },
      update: {
        isActive: true
      },
      create: {
        userId: user.id,
        key,
        name: 'Demo Widget',
        siteKey,
        secretKey,
        domains: ['localhost:3000', 'localhost'],
        isActive: true
      }
    });

    console.log('✓ Demo API key created');
    console.log('  Site Key:', apiKey.siteKey);
    console.log('  Secret Key:', apiKey.secretKey);
    console.log('\n✓ Demo setup complete!');
    console.log('  Visit: http://localhost:3000/demo');
    console.log('  Email: demo@securedapi.com');
    console.log('  Password: demo123');

  } catch (error) {
    console.error('Error setting up demo:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupDemo();
