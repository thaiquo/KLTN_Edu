import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Notification, NotificationSchema } from '../engagement/schemas/notification.schema';
import { CertificateController } from './certificate.controller';
import { CertificateService } from './certificate.service';
import { Certificate, CertificateSchema } from './schemas/certificate.schema';
import { Profile, ProfileSchema } from './schemas/profile.schema';
import { Schedule, ScheduleSchema } from './schemas/schedule.schema';
import { TutorApplicationRecord, TutorApplicationRecordSchema } from './schemas/tutor-application.schema';
import { TutorProfile, TutorProfileSchema } from './schemas/tutor-profile.schema';
import { User, UserSchema } from './schemas/user.schema';
import { UserRole, UserRoleSchema } from './schemas/user-role.schema';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Profile.name, schema: ProfileSchema },
      { name: TutorProfile.name, schema: TutorProfileSchema },
      { name: TutorApplicationRecord.name, schema: TutorApplicationRecordSchema },
      { name: UserRole.name, schema: UserRoleSchema },
      { name: Certificate.name, schema: CertificateSchema },
      { name: Schedule.name, schema: ScheduleSchema },
      // Notification dùng bởi CertificateService để gửi thông báo
      { name: Notification.name, schema: NotificationSchema }
    ])
  ],
  controllers: [UserController, CertificateController],
  providers: [UserService, CertificateService],
  exports: [UserService, CertificateService]
})
export class UserModule {}
