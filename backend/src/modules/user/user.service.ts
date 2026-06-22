import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StorageFile, StorageService } from '../../common/storage/storage.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { CreateTutorProfileDto, ReviewTutorItemDto } from './dto/create-tutor-profile.dto';
import { Profile, ProfileDocument } from './schemas/profile.schema';
import { TutorProfile, TutorProfileDocument } from './schemas/tutor-profile.schema';
import { User, UserDocument } from './schemas/user.schema';

export interface SafeUser {
  id: string;
  fullName: string;
  email: string;
  role: User['role'];
  currentRole: User['currentRole'];
  isVerified: boolean;
}

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Profile.name) private readonly profileModel: Model<ProfileDocument>,
    @InjectModel(TutorProfile.name) private readonly tutorProfileModel: Model<TutorProfileDocument>,
    private readonly storageService: StorageService
  ) {}

  async createStudent(input: { fullName: string; email: string; password: string }) {
    try {
      return await this.userModel.create({
        fullName: input.fullName.trim(),
        email: input.email.toLowerCase().trim(),
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

  async findAllUsers() { return this.userModel.find().select('-password').lean(); }

  async findUserById(userId: string): Promise<SafeUser> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new NotFoundException('User not found');
    return this.toSafeUser(user);
  }

  findSafeUserById(userId: string) { return this.findUserById(userId); }

  async upsertProfile(userId: string, dto: CreateProfileDto) {
    return this.profileModel.findOneAndUpdate(
      { userId },
      { $set: { name: dto.name, avatar: dto.avatar ?? '', address: dto.address ?? '', gender: dto.gender ?? '', phone: dto.phone ?? '', dateOfBirth: dto.dateOfBirth ?? '', bio: dto.bio ?? '' } },
      { upsert: true, new: true }
    ).lean();
  }

  async submitTutorApplication(userId: string, dto: CreateTutorProfileDto) {
    await this.findUserById(userId);
    this.validateTutorApplication(dto);
    for (const subject of dto.teachingSubjects) {
      for (const evidence of subject.evidences) {
        if (!this.storageService.isTutorEvidenceOwnedBy(evidence.fileKey, userId)) {
          throw new BadRequestException('Evidence file does not belong to the current user');
        }
      }
    }

    const teachingSubjects = dto.teachingSubjects.map((subject) => ({
      ...subject,
      durationDays: subject.priceUnit === 'per_30_days' ? (subject.durationDays ?? 30) : (subject.durationDays ?? null),
      verificationStatus: 'pending',
      adminNote: '',
      evidences: subject.evidences.map((evidence) => ({
        ...evidence,
        expiryDate: evidence.expiryDate ?? null,
        description: evidence.description ?? '',
        verificationStatus: 'pending',
        adminNote: ''
      }))
    }));

    return this.tutorProfileModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          bio: dto.bio.trim(),
          weeklyAvailability: dto.weeklyAvailability,
          teachingSubjects,
          status: 'pending',
          adminNote: ''
        },
        $setOnInsert: { rating: 0, totalReviews: 0 }
      },
      { upsert: true, new: true, runValidators: true }
    ).lean();
  }

  getTutorProfile(userId: string) {
    return this.tutorProfileModel.findOne({ userId }).lean();
  }

  listTutorApplications() {
    return this.tutorProfileModel
      .find({ status: { $in: ['pending', 'approved', 'rejected'] } })
      .populate('userId', 'fullName email role currentRole')
      .sort({ updatedAt: -1 })
      .lean();
  }

  async reviewTutorSubject(profileId: string, subjectId: string, dto: ReviewTutorItemDto) {
    const profile = await this.tutorProfileModel.findById(profileId);
    if (!profile) throw new NotFoundException('Tutor application not found');
    const subject = (profile.teachingSubjects as any).id(subjectId);
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
    await this.recalculateApplicationStatus(profile);
    return profile.toObject();
  }

  async reviewSubjectEvidence(
    profileId: string,
    subjectId: string,
    evidenceId: string,
    dto: ReviewTutorItemDto
  ) {
    const profile = await this.tutorProfileModel.findById(profileId);
    if (!profile) throw new NotFoundException('Tutor application not found');
    const subject = (profile.teachingSubjects as any).id(subjectId);
    if (!subject) throw new NotFoundException('Teaching subject not found');
    const evidence = subject.evidences.id(evidenceId);
    if (!evidence) throw new NotFoundException('Evidence not found');

    evidence.verificationStatus = dto.status;
    evidence.adminNote = dto.adminNote?.trim() ?? '';
    if (dto.status === 'rejected' && subject.verificationStatus === 'approved') {
      subject.verificationStatus = 'pending';
    }
    await this.recalculateApplicationStatus(profile);
    return profile.toObject();
  }

  async storeEvidenceFile(userId: string, file: StorageFile) {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Only PDF, PNG and JPG files are accepted');
    }
    return this.storageService.uploadTutorEvidence(userId, file);
  }

  async getEvidenceDownloadUrl(profileId: string, subjectId: string, evidenceId: string) {
    const profile = await this.tutorProfileModel.findById(profileId);
    if (!profile) throw new NotFoundException('Tutor application not found');
    const subject = (profile.teachingSubjects as any).id(subjectId);
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
    const profile = await this.tutorProfileModel.findOne({ userId });
    if (!profile) throw new NotFoundException('Tutor application not found');
    for (const subject of profile.teachingSubjects as any[]) {
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
    throw new NotFoundException('Evidence not found');
  }

  getProfile(userId: string) { return this.profileModel.findOne({ userId }).lean(); }

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
      if (subjectKeys.has(key)) throw new BadRequestException('The same teaching subject cannot be added twice');
      subjectKeys.add(key);
      if (subject.maxPrice < subject.minPrice) {
        throw new BadRequestException('Maximum price must be greater than or equal to minimum price');
      }
      if (['per_30_days', 'per_course'].includes(subject.priceUnit) && !subject.durationDays && subject.priceUnit !== 'per_30_days') {
        throw new BadRequestException('Duration is required for course pricing');
      }
    }
  }

  private async recalculateApplicationStatus(profile: TutorProfileDocument) {
    const statuses = profile.teachingSubjects.map((subject) => subject.verificationStatus);
    if (statuses.length > 0 && statuses.every((status) => status === 'approved')) {
      profile.status = 'approved';
      await this.userModel.updateOne(
        { _id: profile.userId },
        { $set: { role: 'tutor', currentRole: 'tutor', isVerified: true } }
      );
    } else if (statuses.some((status) => status === 'rejected')) {
      profile.status = 'rejected';
    } else {
      profile.status = 'pending';
    }
    await profile.save();
  }

  private isDuplicateKeyError(error: unknown): error is { code: number } {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
  }

  toSafeUser(user: Pick<UserDocument, '_id' | 'fullName' | 'email' | 'role' | 'currentRole' | 'isVerified'>): SafeUser {
    return {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      currentRole: user.currentRole,
      isVerified: user.isVerified
    };
  }
}
