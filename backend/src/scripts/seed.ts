/**
 * Seed script – chạy một lần khi khởi tạo hệ thống.
 * npx ts-node src/scripts/seed.ts
 *
 * Idempotent: chạy nhiều lần không bị lỗi, chỉ tạo nếu chưa có.
 *
 * Thực hiện:
 *  1. Seed collection `roles`  → 3 role mặc định: student | tutor | admin
 *  2. Tạo / cập nhật admin user
 *  3. Tạo / cập nhật bản ghi `user_roles` cho admin
 */

import * as bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { envConfig } from '../config/env.config';

// ── Thông tin admin cố định ───────────────────────────────────────────────────
const ADMIN = {
  fullName: 'Quốc Thái',
  email: 'ngocquocthai.004@gmail.com',
  phone: '0387705790',
  password: 'tt11qq22@@'
} as const;

// ── Các role mặc định của hệ thống ───────────────────────────────────────────
const DEFAULT_ROLES = ['student', 'tutor', 'admin'] as const;

async function main() {
  console.log('⏳  Connecting to MongoDB…');
  await mongoose.connect(envConfig.mongodbUri);
  console.log('✅  Connected:', envConfig.mongodbUri);

  const db = mongoose.connection;
  const rolesCol    = db.collection('roles');
  const usersCol    = db.collection('users');
  const userRolesCol = db.collection('user_roles');

  // ── 1. Seed roles ──────────────────────────────────────────────────────────
  console.log('\n📦  Seeding roles…');
  for (const name of DEFAULT_ROLES) {
    const result = await rolesCol.updateOne(
      { name },
      { $setOnInsert: { name, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
    if (result.upsertedCount) {
      console.log(`  ✔  Role created: ${name}`);
    } else {
      console.log(`  –  Role already exists: ${name}`);
    }
  }

  // ── 2. Lấy roleId của 'admin' ──────────────────────────────────────────────
  const adminRole = await rolesCol.findOne({ name: 'admin' });
  if (!adminRole) throw new Error('Admin role not found after seed – something went wrong.');
  const adminRoleId = adminRole._id;

  // ── 3. Tạo / cập nhật admin user ──────────────────────────────────────────
  console.log('\n👤  Seeding admin user…');
  const hashedPassword = await bcrypt.hash(ADMIN.password, 10);
  const now = new Date();

  const userResult = await usersCol.findOneAndUpdate(
    { email: ADMIN.email },
    {
      $set: {
        fullName:    ADMIN.fullName,
        email:       ADMIN.email,
        phone:       ADMIN.phone,
        password:    hashedPassword,
        role:        'admin',
        currentRole: 'admin',
        isVerified:  true,
        updatedAt:   now
      },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true, returnDocument: 'after' }
  );

  // MongoDB driver trả về document sau khi update/insert
  const adminUser = userResult ?? await usersCol.findOne({ email: ADMIN.email });
  if (!adminUser) throw new Error('Failed to retrieve admin user after upsert.');
  const adminUserId = adminUser._id;

  console.log(`  ✔  Admin user: ${ADMIN.fullName} <${ADMIN.email}>`);
  console.log(`     _id: ${adminUserId}`);

  // ── 4. Tạo / cập nhật user_role cho admin ──────────────────────────────────
  console.log('\n🔗  Linking admin user → admin role…');
  const urResult = await userRolesCol.updateOne(
    { userId: adminUserId },
    {
      $set: {
        userId:    adminUserId,
        roleId:    adminRoleId,
        updatedAt: now
      },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );

  if (urResult.upsertedCount) {
    console.log('  ✔  UserRole record created.');
  } else {
    console.log('  –  UserRole record already exists, updated.');
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n🎉  Seed completed successfully!\n');
  console.log('  ┌─────────────────────────────────────────┐');
  console.log(`  │  Admin email   : ${ADMIN.email}`);
  console.log(`  │  Admin password: ${ADMIN.password}`);
  console.log('  └─────────────────────────────────────────┘\n');
}

main()
  .catch((err) => {
    console.error('\n❌  Seed failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
