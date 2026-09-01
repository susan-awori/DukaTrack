/**
 * Database Seeder for Dukatrack MVP
 * Populates initial mock users (Retailers, Dispatcher, Riders)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial mock users...');

  // Clear existing mock data cleanly
  await prisma.statusEvent.deleteMany();
  await prisma.deliveryRequest.deleteMany();
  await prisma.user.deleteMany();

  const retailer1 = await prisma.user.create({
    data: {
      id: 'ret-101',
      name: 'Mama Mboga Groceries (Kilimani)',
      phone: '+254712345678',
      role: 'retailer',
    },
  });

  const retailer2 = await prisma.user.create({
    data: {
      id: 'ret-102',
      name: 'Nairobi Tech Hub (Westlands)',
      phone: '+254722998877',
      role: 'retailer',
    },
  });

  const dispatcher = await prisma.user.create({
    data: {
      id: 'disp-201',
      name: 'Central Nairobi Logistics Hub',
      phone: '+254700000000',
      role: 'dispatcher',
    },
  });

  const rider1 = await prisma.user.create({
    data: {
      id: 'rider-301',
      name: 'James Omondi (Boda Boda KCB-123A)',
      phone: '+254733112233',
      role: 'rider',
    },
  });

  const rider2 = await prisma.user.create({
    data: {
      id: 'rider-302',
      name: 'Wanjiku Kamau (Express Bike)',
      phone: '+254744556677',
      role: 'rider',
    },
  });

  console.log('Seed completed successfully!');
  console.log('Users created:');
  console.log('  Retailers:', [retailer1.id, retailer2.id]);
  console.log('  Dispatcher:', dispatcher.id);
  console.log('  Riders:', [rider1.id, rider2.id]);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
