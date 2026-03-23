// server/prismaClient.js
import { PrismaClient } from "./generated/prisma/client.js"; // correct path
const prisma = new PrismaClient();
export default prisma;