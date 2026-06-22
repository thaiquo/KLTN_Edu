import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TutorProfile, TutorProfileSchema } from '../user/schemas/tutor-profile.schema';
import { ClassroomController } from './classroom.controller';
import { ClassroomService } from './classroom.service';
import { ClassRoom, ClassRoomSchema } from './schemas/classroom.schema';
import { Enrollment, EnrollmentSchema } from './schemas/enrollment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ClassRoom.name, schema: ClassRoomSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: TutorProfile.name, schema: TutorProfileSchema }
    ])
  ],
  controllers: [ClassroomController],
  providers: [ClassroomService],
  exports: [ClassroomService]
})
export class ClassroomModule {}
