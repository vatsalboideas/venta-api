import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);

  const users = [
    {
      name: "Ava Boss",
      email: "boss@venta.local",
      phone: "+1-555-1000",
      password: passwordHash,
      twoFAEnabled: true,
      position: "Chief Executive Officer",
      department: "Executive",
      role: Role.BOSS,
    },
    {
      name: "Ethan Employee",
      email: "employee1@venta.local",
      phone: "+1-555-1001",
      password: passwordHash,
      twoFAEnabled: false,
      position: "Sales Executive",
      department: "Sales",
      role: Role.EMPLOYEE,
    },
    {
      name: "Mia Employee",
      email: "employee2@venta.local",
      phone: "+1-555-1002",
      password: passwordHash,
      twoFAEnabled: false,
      position: "Business Development",
      department: "Sales",
      role: Role.EMPLOYEE,
    },
    {
      name: "Noah Intern",
      email: "intern@venta.local",
      phone: "+1-555-1003",
      password: passwordHash,
      twoFAEnabled: false,
      position: "Sales Intern",
      department: "Sales",
      role: Role.INTERN,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        phone: user.phone,
        password: user.password,
        twoFAEnabled: user.twoFAEnabled,
        position: user.position,
        department: user.department,
        role: user.role,
      },
      create: user,
    });
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
