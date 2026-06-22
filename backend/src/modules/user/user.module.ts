import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Profile, ProfileSchema } from './schemas/profile.schema';
import { TutorProfile, TutorProfileSchema } from './schemas/tutor-profile.schema';
import { User, UserSchema } from './schemas/user.schema';
import { UserRole, UserRoleSchema } from './schemas/user-role.schema';
import { Certificate, CertificateSchema } from './schemas/certificate.schema';
import { Schedule, ScheduleSchema } from './schemas/schedule.schema';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Profile.name, schema: ProfileSchema },
      { name: TutorProfile.name, schema: TutorProfileSchema },
      { name: UserRole.name, schema: UserRoleSchema },
      { name: Certificate.name, schema: CertificateSchema },
      { name: Schedule.name, schema: ScheduleSchema }
    ])
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService]
})
export class UserModule {}
