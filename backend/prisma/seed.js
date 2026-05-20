const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const products = [
  { name: 'Semen Portland 50kg', category: 'semen', price: 68000, stock: 150, emoji: '', unit: 'sak', minStock: 10 },
  { name: 'Semen Instan Mortar', category: 'semen', price: 52000, stock: 80, emoji: '', unit: 'sak', minStock: 10 },
  { name: 'Pipa PVC 3/4" (6m)', category: 'pipa', price: 32000, stock: 200, emoji: '', unit: 'batang', minStock: 10 },
  { name: 'Pipa PVC 1" (6m)', category: 'pipa', price: 48000, stock: 180, emoji: '', unit: 'batang', minStock: 10 },
  { name: 'Kabel NYM 2x1.5mm (50m)', category: 'kabel', price: 185000, stock: 60, emoji: '⚡', unit: 'rol', minStock: 10 },
  { name: 'Kabel NYA 1.5mm (100m)', category: 'kabel', price: 145000, stock: 45, emoji: '⚡', unit: 'rol', minStock: 10 },
  { name: 'Cat Tembok Putih 25kg', category: 'cat', price: 325000, stock: 30, emoji: '', unit: 'galon', minStock: 10 },
  { name: 'Cat Kayu Gloss 1kg', category: 'cat', price: 68000, stock: 55, emoji: '', unit: 'kaleng', minStock: 10 },
  { name: 'Paku Beton 2" (1kg)', category: 'paku', price: 18000, stock: 300, emoji: '', unit: 'kg', minStock: 10 },
  { name: 'Paku Reng 7cm (1kg)', category: 'paku', price: 22000, stock: 250, emoji: '', unit: 'kg', minStock: 10 },
  { name: 'Kayu Reng 2x3 (4m)', category: 'kayu', price: 22000, stock: 8, emoji: '', unit: 'batang', minStock: 10 },
  { name: 'Kayu Balok 5x10 (4m)', category: 'kayu', price: 85000, stock: 25, emoji: '', unit: 'batang', minStock: 10 },
  { name: 'Lampu LED 10W', category: 'lampu', price: 28000, stock: 120, emoji: '', unit: 'pcs', minStock: 10 },
  { name: 'Lampu LED 18W', category: 'lampu', price: 45000, stock: 90, emoji: '', unit: 'pcs', minStock: 10 },
  { name: 'Baut Mur M10 (50pcs)', category: 'paku', price: 35000, stock: 0, emoji: '', unit: 'pack', minStock: 10 },
  { name: 'Fitting Elbow 3/4"', category: 'pipa', price: 4500, stock: 500, emoji: '', unit: 'pcs', minStock: 10 }
];

async function upsertUser({ name, email, password, role }) {
  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role, isActive: true },
    create: { name, email, passwordHash, role, isActive: true }
  });
}

async function main() {
  await upsertUser({
    name: 'Admin Toko',
    email: 'admin@amj.com',
    password: 'admin123',
    role: Role.ADMIN
  });

  await upsertUser({
    name: 'Kasir Toko',
    email: 'kasir@amj.com',
    password: 'kasir123',
    role: Role.KASIR
  });

  await upsertUser({
    name: 'Budi Santoso',
    email: 'budi@email.com',
    password: 'user123',
    role: Role.PEMBELI
  });

  for (const product of products) {
    const existing = await prisma.product.findFirst({
      where: { name: product.name }
    });

    if (!existing) {
      await prisma.product.create({ data: product });
    }
  }

  console.log('Seed selesai: users + products berhasil dibuat.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
