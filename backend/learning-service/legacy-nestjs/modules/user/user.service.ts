import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StorageFile, StorageService } from '../../common/storage/storage.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { CreateTutorProfileDto, ReviewTutorItemDto } from './dto/create-tutor-profile.dto';
import { Profile, ProfileDocument } from './schemas/profile.schema';
import {
  TutorApplicationRecord,
  TutorApplicationRecordDocument
} from './schemas/tutor-application.schema';
import { TutorProfile, TutorProfileDocument } from './schemas/tutor-profile.schema';
import { User, UserDocument } from './schemas/user.schema';

export interface SafeUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: User['role'];
  currentRole: User['currentRole'];
  isVerified: boolean;
}

@Injectable()
export class UserService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Profile.name) private readonly profileModel: Model<ProfileDocument>,
    @InjectModel(TutorProfile.name) private readonly tutorProfileModel: Model<TutorProfileDocument>,
    @InjectModel(TutorApplicationRecord.name)
    private readonly tutorApplicationModel: Model<TutorApplicationRecordDocument>,
    private readonly storageService: StorageService
  ) {}

  async onModuleInit() {
    await this.migrateLegacyTutorApplications();
  }

  async createStudent(input: { fullName: string; email: string; phone: string; password: string }) {
    try {
      return await this.userModel.create({
        fullName: input.fullName.trim(),
        email: input.email.toLowerCase().trim(),
        phone: input.phone.trim(),
        password: input.password,
        role: 'student',
        currentRole: 'student'
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) throw new ConflictException('Email is already registered');
      throw error;
    }
  }

  findByEmailWithPassword(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).select('+password');
  }

  async findAllUsers() {
    return this.userModel.find().select('-password').lean();
  }

  async findUserById(userId: string): Promise<SafeUser> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new NotFoundException('User not found');
    return this.toSafeUser(user);
  }

  findSafeUserById(userId: string) {
    return this.findUserById(userId);
  }

  async upsertProfile(userId: string, dto: CreateProfileDto) {
    return this.profileModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          name: dto.name,
          avatar: dto.avatar ?? '',
          address: dto.address ?? '',
          gender: dto.gender ?? '',
          phone: dto.phone ?? '',
          dateOfBirth: dto.dateOfBirth ?? '',
          bio: dto.bio ?? ''
        }
      },
      { upsert: true, new: true }
    ).lean();
  }

  async createTutorApplication(userId: string, dto: CreateTutorProfileDto) {
    await this.findUserById(userId);
    const pendingApplication = await this.tutorApplicationModel.exists({ userId, status: 'pending' });
    if (pendingApplication) {
      throw new ConflictException('Update or withdraw your pending application before creating another one');
    }

    const prepared = await this.prepareTutorApplication(userId, dto);
    return this.tutorApplicationModel.create({
      userId,
      ...prepared,
      status: 'pending',
      adminNote: '',
      revision: 1,
      submittedAt: new Date(),
      reviewedAt: null,
      withdrawnAt: null
    });
  }

  submitTutorApplication(userId: string, dto: CreateTutorProfileDto) {
    return this.createTutorApplication(userId, dto);
  }

  async updateTutorApplication(userId: string, applicationId: string, dto: CreateTutorProfileDto) {
    const application = await this.tutorApplicationModel.findOne({ _id: applicationId, userId });
    if (!application) throw new NotFoundException('Tutor application not found');
    if (!['pending', 'rejected'].includes(application.status)) {
      throw new BadRequestException('Only pending or rejected applications can be updated');
    }

    const prepared = await this.prepareTutorApplication(userId, dto);
    application.set({
      ...prepared,
      status: 'pending',
      adminNote: '',
      revision: application.revision + 1,
      submittedAt: new Date(),
      reviewedAt: null,
      withdrawnAt: null
    });
    await application.save();
    return application.toObject();
  }

  async withdrawTutorApplication(userId: string, applicationId: string) {
    const application = await this.tutorApplicationModel.findOne({ _id: applicationId, userId });
    if (!application) throw new NotFoundException('Tutor application not found');
    if (!['pending', 'rejected'].includes(application.status)) {
      throw new BadRequestException('Only pending or rejected applications can be withdrawn');
    }

    application.status = 'withdrawn';
    application.withdrawnAt = new Date();
    application.reviewedAt = null;
    await application.save();
    return application.toObject();
  }

  listOwnTutorApplications(userId: string) {
    return this.tutorApplicationModel.find({ userId }).sort({ submittedAt: -1, createdAt: -1 }).lean();
  }

  listTutorApplications() {
    return this.tutorApplicationModel
      .find({ status: 'pending' })
      .populate('userId', 'fullName email phone role currentRole')
      .sort({ submittedAt: -1, updatedAt: -1 })
      .lean();
  }

  listTutorApplicationHistory() {
    return this.tutorApplicationModel
      .find({ status: { $in: ['approved', 'rejected', 'withdrawn'] } })
      .populate('userId', 'fullName email phone role currentRole')
      .sort({ updatedAt: -1 })
      .lean();
  }

  getTutorProfile(userId: string) {
    return this.tutorProfileModel.findOne({ userId, isAggregate: true }).lean();
  }

  async reviewTutorSubject(applicationId: string, subjectId: string, dto: ReviewTutorItemDto) {
    const application = await this.getPendingApplication(applicationId);
    const subject = (application.teachingSubjects as any).id(subjectId);
    if (!subject) throw new NotFoundException('Teaching subject not found');

    if (dto.status === 'approved') {
      if (subject.evidences.length === 0) {
        throw new BadRequestException('At least one approved evidence is required for this subject');
      }
      const unapprovedEvidence = subject.evidences.some(
        (evidence: { verificationStatus: string }) => evidence.verificationStatus !== 'approved'
      );
      if (unapprovedEvidence) {
        throw new BadRequestException('Approve every evidence for this subject before approving the subject');
      }
    }

    subject.verificationStatus = dto.status;
    subject.adminNote = dto.adminNote?.trim() ?? '';
    await this.recalculateApplicationStatus(application);
    return application.toObject();
  }

  async reviewSubjectEvidence(
    applicationId: string,
    subjectId: string,
    evidenceId: string,
    dto: ReviewTutorItemDto
  ) {
    const application = await this.getPendingApplication(applicationId);
    const subject = (application.teachingSubjects as any).id(subjectId);
    if (!subject) throw new NotFoundException('Teaching subject not found');
    const evidence = subject.evidences.id(evidenceId);
    if (!evidence) throw new NotFoundException('Evidence not found');

    evidence.verificationStatus = dto.status;
    evidence.adminNote = dto.adminNote?.trim() ?? '';
    if (dto.status === 'rejected' && subject.verificationStatus === 'approved') {
      subject.verificationStatus = 'pending';
    }
    await application.save();
    return application.toObject();
  }

  async storeEvidenceFile(userId: string, file: StorageFile) {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Only PDF, PNG and JPG files are accepted');
    }
    return this.storageService.uploadTutorEvidence(userId, file);
  }

  async getEvidenceDownloadUrl(applicationId: string, subjectId: string, evidenceId: string) {
    const application = await this.tutorApplicationModel.findById(applicationId);
    if (!application) throw new NotFoundException('Tutor application not found');
    const subject = (application.teachingSubjects as any).id(subjectId);
    if (!subject) throw new NotFoundException('Teaching subject not found');
    const evidence = subject.evidences.id(evidenceId);
    if (!evidence) throw new NotFoundException('Evidence not found');
    const url = await this.storageService.createDownloadUrl(
      evidence.fileKey,
      evidence.originalFileName,
      'inline',
      300
    );
    return { url, expiresIn: 300 };
  }

  async getOwnEvidenceDownloadUrl(userId: string, evidenceId: string) {
    const applications = await this.tutorApplicationModel.find({
      userId,
      'teachingSubjects.evidences._id': evidenceId
    });
    for (const application of applications) {
      for (const subject of application.teachingSubjects as any[]) {
        const evidence = subject.evidences.id(evidenceId);
        if (evidence) {
          const url = await this.storageService.createDownloadUrl(
            evidence.fileKey,
            evidence.originalFileName,
            'inline',
            300
          );
          return { url, expiresIn: 300 };
        }
      }
    }
    throw new NotFoundException('Evidence not found');
  }

  getProfile(userId: string) {
    return this.profileModel.findOne({ userId }).lean();
  }

  private async prepareTutorApplication(userId: string, dto: CreateTutorProfileDto) {
    this.validateTutorApplication(dto);
    for (const subject of dto.teachingSubjects) {
      for (const evidence of subject.evidences) {
        if (!this.storageService.isTutorEvidenceOwnedBy(evidence.fileKey, userId)) {
          throw new BadRequestException('Evidence file does not belong to the current user');
        }
      }
    }

    return {
      bio: dto.bio.trim(),
      weeklyAvailability: dto.weeklyAvailability,
      teachingSubjects: dto.teachingSubjects.map((subject) => ({
        ...subject,
        durationDays: subject.priceUnit === 'per_30_days'
          ? (subject.durationDays ?? 30)
          : (subject.durationDays ?? null),
        verificationStatus: 'pending',
        adminNote: '',
        evidences: subject.evidences.map((evidence) => ({
          ...evidence,
          expiryDate: evidence.expiryDate ?? null,
          description: evidence.description ?? '',
          verificationStatus: 'pending',
          adminNote: ''
        }))
      }))
    };
  }

  private validateTutorApplication(dto: CreateTutorProfileDto) {
    for (const slot of dto.weeklyAvailability) {
      if (slot.startTime >= slot.endTime) {
        throw new BadRequestException('Availability start time must be earlier than end time');
      }
    }
    const sortedSlots = [...dto.weeklyAvailability].sort(
      (a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)
    );
    for (let index = 1; index < sortedSlots.length; index += 1) {
      const previous = sortedSlots[index - 1];
      const current = sortedSlots[index];
      if (previous.dayOfWeek === current.dayOfWeek && current.startTime < previous.endTime) {
        throw new BadRequestException('Availability slots cannot overlap on the same day');
      }
    }

    const subjectKeys = new Set<string>();
    for (const subject of dto.teachingSubjects) {
      const key = `${subject.levelGroupId}:${subject.subjectId}`;
      if (subjectKeys.has(key)) {
        throw new BadRequestException('The same teaching subject cannot be added twice');
      }
      subjectKeys.add(key);
      if (subject.maxPrice < subject.minPrice) {
        throw new BadRequestException('Maximum price must be greater than or equal to minimum price');
      }
      if (subject.priceUnit === 'per_course' && !subject.durationDays) {
        throw new BadRequestException('Duration is required for course pricing');
      }
    }
  }

  private async getPendingApplication(applicationId: string) {
    const application = await this.tutorApplicationModel.findById(applicationId);
    if (!application) throw new NotFoundException('Tutor application not found');
    if (application.status !== 'pending') {
      throw new BadRequestException('This tutor application is no longer pending');
    }
    return application;
  }

  private async recalculateApplicationStatus(application: TutorApplicationRecordDocument) {
    const statuses = application.teachingSubjects.map((subject: any) => subject.verificationStatus);
    if (statuses.length > 0 && statuses.every((status: string) => status === 'approved')) {
      application.status = 'approved';
      application.reviewedAt = new Date();
      await application.save();
      await this.promoteApprovedApplication(application);
      return;
    }
    if (statuses.some((status: string) => status === 'rejected')) {
      application.status = 'rejected';
      application.reviewedAt = new Date();
    } else {
      application.status = 'pending';
      application.reviewedAt = null;
    }
    await application.save();
  }

  private async promoteApprovedApplication(application: TutorApplicationRecordDocument) {
    let profile = await this.tutorProfileModel.findOne({ userId: application.userId, isAggregate: true });
    if (!profile) {
      profile = new this.tutorProfileModel({
        userId: application.userId,
        teachingSubjects: [],
        rating: 0,
        totalReviews: 0,
        isAggregate: true
      });
    }

    const mergedSubjects = (profile.teachingSubjects as any[]).map((subject) =>
      typeof subject.toObject === 'function' ? subject.toObject() : subject
    );
    for (const applicationSubject of application.teachingSubjects as any[]) {
      const nextSubject = typeof applicationSubject.toObject === 'function'
        ? applicationSubject.toObject()
        : applicationSubject;
      const existingIndex = mergedSubjects.findIndex(
        (subject) =>
          subject.levelGroupId === nextSubject.levelGroupId &&
          subject.subjectId === nextSubject.subjectId
      );
      if (existingIndex >= 0) mergedSubjects[existingIndex] = nextSubject;
      else mergedSubjects.push(nextSubject);
    }

    profile.set({
      bio: application.bio,
      weeklyAvailability: application.weeklyAvailability,
      teachingSubjects: mergedSubjects,
      status: 'approved',
      adminNote: '',
      isAggregate: true
    });
    await profile.save();
    await this.userModel.updateOne(
      { _id: application.userId },
      { $set: { role: 'tutor', currentRole: 'tutor', isVerified: true } }
    );
  }

  private async migrateLegacyTutorApplications() {
    const legacyProfiles = await this.tutorProfileModel.find({ isAggregate: { $ne: true } });
    for (const legacy of legacyProfiles) {
      const legacyProfileId = legacy._id.toString();
      const alreadyMigrated = await this.tutorApplicationModel.exists({ legacyProfileId });
      if (!alreadyMigrated) {
        await this.tutorApplicationModel.create({
          userId: legacy.userId,
          bio: legacy.bio,
          weeklyAvailability: legacy.weeklyAvailability,
          teachingSubjects: legacy.teachingSubjects,
          status: legacy.status,
          adminNote: legacy.adminNote,
          revision: 1,
          submittedAt: (legacy as any).createdAt ?? new Date(),
          reviewedAt: legacy.status === 'pending' ? null : ((legacy as any).updatedAt ?? new Date()),
          withdrawnAt: null,
          legacyProfileId
        });
      }

      if (legacy.status === 'approved') {
        legacy.isAggregate = true;
        await legacy.save();
      } else {
        await this.tutorProfileModel.deleteOne({ _id: legacy._id });
      }
    }
  }

  private isDuplicateKeyError(error: unknown): error is { code: number } {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
  }

  toSafeUser(
    user: Pick<UserDocument, '_id' | 'fullName' | 'email' | 'phone' | 'role' | 'currentRole' | 'isVerified'>
  ): SafeUser {
    return {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      currentRole: user.currentRole,
      isVerified: user.isVerified
    };
  }
}
