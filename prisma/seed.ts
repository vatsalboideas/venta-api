import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
  const boss = await prisma.user.upsert({
    where: { email: "boss@venta.local" },
    update: {
      name: "Ava Boss",
      phone: "+1-555-1000",
      password: passwordHash,
      twoFAEnabled: true,
      twoFASecret: null,
      position: "Chief Executive Officer",
      department: "Executive",
      role: Role.BOSS,
      createdBy: null,
    },
    create: {
      name: "Ava Boss",
      email: "boss@venta.local",
      phone: "+1-555-1000",
      password: passwordHash,
      twoFAEnabled: true,
      twoFASecret: null,
      position: "Chief Executive Officer",
      department: "Executive",
      role: Role.BOSS,
      createdBy: null,
    },
    select: { id: true },
  });

  await prisma.user.deleteMany({
    where: {
      email: { in: ["intern@venta.local"] },
    },
  });

  const managerIds: string[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const manager = await prisma.user.upsert({
      where: { email: `manager${i}@venta.local` },
      update: {
        name: `Manager ${i}`,
        phone: `+1-555-20${String(i).padStart(2, "0")}`,
        password: passwordHash,
        twoFAEnabled: false,
        twoFASecret: null,
        position: "Regional Sales Manager",
        department: "Sales",
        role: Role.MANAGER,
        createdBy: boss.id,
      },
      create: {
        name: `Manager ${i}`,
        email: `manager${i}@venta.local`,
        phone: `+1-555-20${String(i).padStart(2, "0")}`,
        password: passwordHash,
        twoFAEnabled: false,
        twoFASecret: null,
        position: "Regional Sales Manager",
        department: "Sales",
        role: Role.MANAGER,
        createdBy: boss.id,
      },
      select: { id: true },
    });
    managerIds.push(manager.id);
  }

  for (let i = 1; i <= 5; i += 1) {
    await prisma.user.upsert({
      where: { email: `employee${i}@venta.local` },
      update: {
        name: `Employee ${i}`,
        phone: `+1-555-30${String(i).padStart(2, "0")}`,
        password: passwordHash,
        twoFAEnabled: false,
        twoFASecret: null,
        position: "Sales Executive",
        department: "Sales",
        role: Role.EMPLOYEE,
        createdBy: managerIds[(i - 1) % managerIds.length],
      },
      create: {
        name: `Employee ${i}`,
        email: `employee${i}@venta.local`,
        phone: `+1-555-30${String(i).padStart(2, "0")}`,
        password: passwordHash,
        twoFAEnabled: false,
        twoFASecret: null,
        position: "Sales Executive",
        department: "Sales",
        role: Role.EMPLOYEE,
        createdBy: managerIds[(i - 1) % managerIds.length],
      },
    });
  }

  for (let i = 1; i <= 5; i += 1) {
    await prisma.user.upsert({
      where: { email: `intern${i}@venta.local` },
      update: {
        name: `Intern ${i}`,
        phone: `+1-555-40${String(i).padStart(2, "0")}`,
        password: passwordHash,
        twoFAEnabled: false,
        twoFASecret: null,
        position: "Sales Intern",
        department: "Sales",
        role: Role.INTERN,
        createdBy: managerIds[(i - 1) % managerIds.length],
      },
      create: {
        name: `Intern ${i}`,
        email: `intern${i}@venta.local`,
        phone: `+1-555-40${String(i).padStart(2, "0")}`,
        password: passwordHash,
        twoFAEnabled: false,
        twoFASecret: null,
        position: "Sales Intern",
        department: "Sales",
        role: Role.INTERN,
        createdBy: managerIds[(i - 1) % managerIds.length],
      },
    });
  }

  await prisma.$transaction([
    prisma.logRevision.deleteMany({}),
    prisma.log.deleteMany({}),
    prisma.contact.deleteMany({}),
    prisma.brand.deleteMany({}),
  ]);

  const brands = [
    {
      name: "Nimbus Retail",
      industry: "Retail",
      priority: "HIGH" as const,
      forecastCategory: "PIPELINE" as const,
      expectedRevenue: 250000,
      website: "https://nimbus-retail.example.com",
      description: "National retail transformation account",
      ownerId: managerIds[0],
    },
    {
      name: "Orion Health",
      industry: "Healthcare",
      priority: "MEDIUM" as const,
      forecastCategory: "COMMIT" as const,
      expectedRevenue: 190000,
      website: "https://orion-health.example.com",
      description: "Hospital operations modernization",
      ownerId: managerIds[1],
    },
    {
      name: "Atlas Manufacturing",
      industry: "Manufacturing",
      priority: "HIGH" as const,
      forecastCategory: "PIPELINE" as const,
      expectedRevenue: 310000,
      website: "https://atlas-mfg.example.com",
      description: "Factory digitalization program",
      ownerId: managerIds[2],
    },
    {
      name: "Bluewave Finance",
      industry: "Financial Services",
      priority: "LOW" as const,
      forecastCategory: "PIPELINE" as const,
      expectedRevenue: 140000,
      website: "https://bluewave-finance.example.com",
      description: "CRM process upgrade",
      ownerId: managerIds[3],
    },
    {
      name: "Solstice Energy",
      industry: "Energy",
      priority: "MEDIUM" as const,
      forecastCategory: "COMMIT" as const,
      expectedRevenue: 225000,
      website: "https://solstice-energy.example.com",
      description: "Field service productivity initiative",
      ownerId: managerIds[4],
    },
  ];

  const createdBrands = [];
  for (const brand of brands) {
    const created = await prisma.brand.create({ data: brand });
    createdBrands.push(created);
  }

  const createdContacts: { id: string; brandId: string }[] = [];
  for (let i = 0; i < createdBrands.length; i += 1) {
    for (let j = 1; j <= 3; j += 1) {
      const createdContact = await prisma.contact.create({
        data: {
          brandId: createdBrands[i].id,
          name: `Contact ${i + 1}-${j}`,
          position: j === 1 ? "Director" : j === 2 ? "Manager" : "Lead Analyst",
          email: `contact${i + 1}${j}@venta.local`,
          phone: `+1-555-${50 + i}${j}0`,
          address: `${100 + i * 10 + j} Market Street`,
          createdBy: createdBrands[i].ownerId,
        },
      });
      createdContacts.push({ id: createdContact.id, brandId: createdBrands[i].id });
    }
  }

  const now = new Date();
  for (const [index, brand] of createdBrands.entries()) {
    const brandContacts = createdContacts.filter((contact) => contact.brandId === brand.id);
    for (let k = 0; k < 2; k += 1) {
      const baseDate = new Date(now);
      baseDate.setDate(baseDate.getDate() - (index * 4 + k + 1));
      const followUpDate = new Date(baseDate);
      followUpDate.setDate(followUpDate.getDate() + 7);
      const meetingDate = new Date(baseDate);
      meetingDate.setDate(meetingDate.getDate() + 14);

      await prisma.log.create({
        data: {
          title: `${brand.name} Opportunity ${k + 1}`,
          brandId: brand.id,
          contactId: brandContacts[k % brandContacts.length].id,
          status: k % 2 === 0 ? "MEET_PRESENT" : "PROPOSAL_SENT",
          priority: k % 2 === 0 ? "HIGH" : "MEDIUM",
          assignedTo: brand.ownerId,
          lastContactDate: baseDate,
          followUpDate,
          meetingDate,
          actualRevenue: 25000 + index * 5000 + k * 2500,
          notes: `Follow-up activity ${k + 1} for ${brand.name}`,
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
