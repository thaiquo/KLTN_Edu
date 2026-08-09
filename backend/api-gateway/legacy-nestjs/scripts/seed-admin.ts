import * as bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { envConfig } from '../config/env.config';

async function seedAdmin() {
  const fullName = process.env.ADMIN_FULL_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const phone = process.env.ADMIN_PHONE?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!fullName || !email || !phone || !password) {
    throw new Error('ADMIN_FULL_NAME, ADMIN_EMAIL, ADMIN_PHONE and ADMIN_PASSWORD are required');
  }
  if (!/^0\d{9}$/.test(phone)) {
    throw new Error('ADMIN_PHONE must contain 10 digits and start with 0');
  }

  await mongoose.connect(envConfig.mongodbUri);
  const users = mongoose.connection.collection('users');
  const existing = await users.findOne({ email });
  const now = new Date();

  await users.updateOne(
    { email },
    {
      $set: {
        fullName,
        email,
        phone,
        password: await bcrypt.hash(password, 10),
        role: 'admin',
        currentRole: 'admin',
        isVerified: true,
        updatedAt: now
      },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );

  console.log(existing ? 'Admin account updated.' : 'Admin account created.');
}

seedAdmin()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
