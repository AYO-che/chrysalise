import bcrypt from "bcrypt";

async function generateHash() {
  const hash = await bcrypt.hash("aya123", 10);
  console.log(hash);
}

generateHash();