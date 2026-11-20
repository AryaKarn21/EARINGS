const { prisma } = require('../src/db/prisma');

async function main() {
  const cols = await prisma.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'AuthToken'`;
  console.log("AuthToken columns:", cols);
  const rows = await prisma.$queryRaw`SELECT * FROM "AuthToken"`;
  console.log("AuthToken rows:", rows);
}

main().catch(console.error).finally(() => prisma.$disconnect());
