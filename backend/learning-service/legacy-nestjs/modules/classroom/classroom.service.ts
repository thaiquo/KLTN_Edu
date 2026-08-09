import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TutorProfile, TutorProfileDocument } from '../user/schemas/tutor-profile.schema';
import { CreateClassRoomDto } from './dto/create-classroom.dto';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { ClassRoom, ClassRoomDocument } from './schemas/classroom.schema';
import { Enrollment, EnrollmentDocument } from './schemas/enrollment.schema';

@Injectable()
export class ClassroomService {
  constructor(
    @InjectModel(ClassRoom.name) private readonly classRoomModel: Model<ClassRoomDocument>,
    @InjectModel(Enrollment.name) private readonly enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(TutorProfile.name) private readonly tutorProfileModel: Model<TutorProfileDocument>
  ) {}

  async createClassRoom(dto: CreateClassRoomDto) {
    const tutorProfile = await this.tutorProfileModel.findOne({ userId: dto.tutorId });
    if (!tutorProfile) throw new ForbiddenException('An approved tutor profile is required');
    const tutorSubject = tutorProfile.teachingSubjects.find(
      (subject: any) => subject._id.toString() === dto.tutorSubjectId
    );
    if (!tutorSubject || tutorSubject.verificationStatus !== 'approved') {
      throw new ForbiddenException('Only an approved teaching subject can be used to create a class');
    }
    if (dto.priceUnit !== tutorSubject.priceUnit) {
      throw new BadRequestException('Class price unit must match the approved subject price unit');
    }
    if (dto.price < tutorSubject.minPrice || dto.price > tutorSubject.maxPrice) {
      throw new BadRequestException(
        `Class price must be between ${tutorSubject.minPrice} and ${tutorSubject.maxPrice}`
      );
    }

    const created = new this.classRoomModel({
      tutorId: dto.tutorId,
      tutorSubjectId: dto.tutorSubjectId,
      studentIds: dto.studentIds ?? [],
      name: dto.name ?? 'Untitled class',
      description: dto.description ?? '',
      subjectIds: dto.subjectIds ?? [],
      pricePerSession: dto.pricePerSession ?? dto.price,
      price: dto.price,
      priceUnit: dto.priceUnit,
      status: dto.status ?? 'draft',
      maxStudents: dto.maxStudents ?? Math.max(dto.studentIds?.length ?? 1, 1),
      startDate: dto.startDate ?? '',
      endDate: dto.endDate ?? '',
      schedule: dto.schedule ?? {},
      contractAddress: dto.contractAddress ?? ''
    });
    return created.save();
  }

  async getAllClassRooms() {
    return this.classRoomModel.find().lean();
  }

  async getClassRoomById(classId: string) {
    const classRoom = await this.classRoomModel.findById(classId).lean();
    if (!classRoom) throw new NotFoundException('ClassRoom not found');
    return classRoom;
  }

  async createEnrollment(dto: CreateEnrollmentDto) {
    const classRoom = await this.classRoomModel.findById(dto.classId).lean();
    if (!classRoom) throw new NotFoundException('Cannot enroll: class not found');

    const created = new this.enrollmentModel({
      classId: dto.classId,
      classRoomId: dto.classRoomId ?? dto.classId,
      studentId: dto.studentId,
      userId: dto.userId ?? dto.studentId,
      joinDate: dto.joinDate ?? new Date().toISOString(),
      status: dto.status ?? 'active'
    });
    await this.classRoomModel.updateOne(
      { _id: dto.classId },
      { $addToSet: { studentIds: dto.studentId } }
    );
    return created.save();
  }

  async getEnrollmentsByClass(classId: string) {
    return this.enrollmentModel.find({ classId }).lean();
  }
}
