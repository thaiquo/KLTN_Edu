"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const storage_service_1 = require("../../common/storage/storage.service");
const profile_schema_1 = require("./schemas/profile.schema");
const tutor_application_schema_1 = require("./schemas/tutor-application.schema");
const tutor_profile_schema_1 = require("./schemas/tutor-profile.schema");
const user_schema_1 = require("./schemas/user.schema");
let UserService = class UserService {
    constructor(userModel, profileModel, tutorProfileModel, tutorApplicationModel, storageService) {
        this.userModel = userModel;
        this.profileModel = profileModel;
        this.tutorProfileModel = tutorProfileModel;
        this.tutorApplicationModel = tutorApplicationModel;
        this.storageService = storageService;
    }
    async onModuleInit() {
        await this.migrateLegacyTutorApplications();
    }
    async createStudent(input) {
        try {
            return await this.userModel.create({
                fullName: input.fullName.trim(),
                email: input.email.toLowerCase().trim(),
                phone: input.phone.trim(),
                password: input.password,
                role: 'student',
                currentRole: 'student'
            });
        }
        catch (error) {
            if (this.isDuplicateKeyError(error))
                throw new common_1.ConflictException('Email is already registered');
            throw error;
        }
    }
    findByEmailWithPassword(email) {
        return this.userModel.findOne({ email: email.toLowerCase().trim() }).select('+password');
    }
    async findAllUsers() {
        return this.userModel.find().select('-password').lean();
    }
    async findUserById(userId) {
        const user = await this.userModel.findById(userId).lean();
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return this.toSafeUser(user);
    }
    findSafeUserById(userId) {
        return this.findUserById(userId);
    }
    async upsertProfile(userId, dto) {
        return this.profileModel.findOneAndUpdate({ userId }, {
            $set: {
                name: dto.name,
                avatar: dto.avatar ?? '',
                address: dto.address ?? '',
                gender: dto.gender ?? '',
                phone: dto.phone ?? '',
                dateOfBirth: dto.dateOfBirth ?? '',
                bio: dto.bio ?? ''
            }
        }, { upsert: true, new: true }).lean();
    }
    async createTutorApplication(userId, dto) {
        await this.findUserById(userId);
        const pendingApplication = await this.tutorApplicationModel.exists({ userId, status: 'pending' });
        if (pendingApplication) {
            throw new common_1.ConflictException('Update or withdraw your pending application before creating another one');
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
    submitTutorApplication(userId, dto) {
        return this.createTutorApplication(userId, dto);
    }
    async updateTutorApplication(userId, applicationId, dto) {
        const application = await this.tutorApplicationModel.findOne({ _id: applicationId, userId });
        if (!application)
            throw new common_1.NotFoundException('Tutor application not found');
        if (!['pending', 'rejected'].includes(application.status)) {
            throw new common_1.BadRequestException('Only pending or rejected applications can be updated');
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
    async withdrawTutorApplication(userId, applicationId) {
        const application = await this.tutorApplicationModel.findOne({ _id: applicationId, userId });
        if (!application)
            throw new common_1.NotFoundException('Tutor application not found');
        if (!['pending', 'rejected'].includes(application.status)) {
            throw new common_1.BadRequestException('Only pending or rejected applications can be withdrawn');
        }
        application.status = 'withdrawn';
        application.withdrawnAt = new Date();
        application.reviewedAt = null;
        await application.save();
        return application.toObject();
    }
    listOwnTutorApplications(userId) {
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
    getTutorProfile(userId) {
        return this.tutorProfileModel.findOne({ userId, isAggregate: true }).lean();
    }
    async reviewTutorSubject(applicationId, subjectId, dto) {
        const application = await this.getPendingApplication(applicationId);
        const subject = application.teachingSubjects.id(subjectId);
        if (!subject)
            throw new common_1.NotFoundException('Teaching subject not found');
        if (dto.status === 'approved') {
            if (subject.evidences.length === 0) {
                throw new common_1.BadRequestException('At least one approved evidence is required for this subject');
            }
            const unapprovedEvidence = subject.evidences.some((evidence) => evidence.verificationStatus !== 'approved');
            if (unapprovedEvidence) {
                throw new common_1.BadRequestException('Approve every evidence for this subject before approving the subject');
            }
        }
        subject.verificationStatus = dto.status;
        subject.adminNote = dto.adminNote?.trim() ?? '';
        await this.recalculateApplicationStatus(application);
        return application.toObject();
    }
    async reviewSubjectEvidence(applicationId, subjectId, evidenceId, dto) {
        const application = await this.getPendingApplication(applicationId);
        const subject = application.teachingSubjects.id(subjectId);
        if (!subject)
            throw new common_1.NotFoundException('Teaching subject not found');
        const evidence = subject.evidences.id(evidenceId);
        if (!evidence)
            throw new common_1.NotFoundException('Evidence not found');
        evidence.verificationStatus = dto.status;
        evidence.adminNote = dto.adminNote?.trim() ?? '';
        if (dto.status === 'rejected' && subject.verificationStatus === 'approved') {
            subject.verificationStatus = 'pending';
        }
        await application.save();
        return application.toObject();
    }
    async storeEvidenceFile(userId, file) {
        const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
        if (!allowed.includes(file.mimetype)) {
            throw new common_1.BadRequestException('Only PDF, PNG and JPG files are accepted');
        }
        return this.storageService.uploadTutorEvidence(userId, file);
    }
    async getEvidenceDownloadUrl(applicationId, subjectId, evidenceId) {
        const application = await this.tutorApplicationModel.findById(applicationId);
        if (!application)
            throw new common_1.NotFoundException('Tutor application not found');
        const subject = application.teachingSubjects.id(subjectId);
        if (!subject)
            throw new common_1.NotFoundException('Teaching subject not found');
        const evidence = subject.evidences.id(evidenceId);
        if (!evidence)
            throw new common_1.NotFoundException('Evidence not found');
        const url = await this.storageService.createDownloadUrl(evidence.fileKey, evidence.originalFileName, 'inline', 300);
        return { url, expiresIn: 300 };
    }
    async getOwnEvidenceDownloadUrl(userId, evidenceId) {
        const applications = await this.tutorApplicationModel.find({
            userId,
            'teachingSubjects.evidences._id': evidenceId
        });
        for (const application of applications) {
            for (const subject of application.teachingSubjects) {
                const evidence = subject.evidences.id(evidenceId);
                if (evidence) {
                    const url = await this.storageService.createDownloadUrl(evidence.fileKey, evidence.originalFileName, 'inline', 300);
                    return { url, expiresIn: 300 };
                }
            }
        }
        throw new common_1.NotFoundException('Evidence not found');
    }
    getProfile(userId) {
        return this.profileModel.findOne({ userId }).lean();
    }
    async prepareTutorApplication(userId, dto) {
        this.validateTutorApplication(dto);
        for (const subject of dto.teachingSubjects) {
            for (const evidence of subject.evidences) {
                if (!this.storageService.isTutorEvidenceOwnedBy(evidence.fileKey, userId)) {
                    throw new common_1.BadRequestException('Evidence file does not belong to the current user');
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
    validateTutorApplication(dto) {
        for (const slot of dto.weeklyAvailability) {
            if (slot.startTime >= slot.endTime) {
                throw new common_1.BadRequestException('Availability start time must be earlier than end time');
            }
        }
        const sortedSlots = [...dto.weeklyAvailability].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
        for (let index = 1; index < sortedSlots.length; index += 1) {
            const previous = sortedSlots[index - 1];
            const current = sortedSlots[index];
            if (previous.dayOfWeek === current.dayOfWeek && current.startTime < previous.endTime) {
                throw new common_1.BadRequestException('Availability slots cannot overlap on the same day');
            }
        }
        const subjectKeys = new Set();
        for (const subject of dto.teachingSubjects) {
            const key = `${subject.levelGroupId}:${subject.subjectId}`;
            if (subjectKeys.has(key)) {
                throw new common_1.BadRequestException('The same teaching subject cannot be added twice');
            }
            subjectKeys.add(key);
            if (subject.maxPrice < subject.minPrice) {
                throw new common_1.BadRequestException('Maximum price must be greater than or equal to minimum price');
            }
            if (subject.priceUnit === 'per_course' && !subject.durationDays) {
                throw new common_1.BadRequestException('Duration is required for course pricing');
            }
        }
    }
    async getPendingApplication(applicationId) {
        const application = await this.tutorApplicationModel.findById(applicationId);
        if (!application)
            throw new common_1.NotFoundException('Tutor application not found');
        if (application.status !== 'pending') {
            throw new common_1.BadRequestException('This tutor application is no longer pending');
        }
        return application;
    }
    async recalculateApplicationStatus(application) {
        const statuses = application.teachingSubjects.map((subject) => subject.verificationStatus);
        if (statuses.length > 0 && statuses.every((status) => status === 'approved')) {
            application.status = 'approved';
            application.reviewedAt = new Date();
            await application.save();
            await this.promoteApprovedApplication(application);
            return;
        }
        if (statuses.some((status) => status === 'rejected')) {
            application.status = 'rejected';
            application.reviewedAt = new Date();
        }
        else {
            application.status = 'pending';
            application.reviewedAt = null;
        }
        await application.save();
    }
    async promoteApprovedApplication(application) {
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
        const mergedSubjects = profile.teachingSubjects.map((subject) => typeof subject.toObject === 'function' ? subject.toObject() : subject);
        for (const applicationSubject of application.teachingSubjects) {
            const nextSubject = typeof applicationSubject.toObject === 'function'
                ? applicationSubject.toObject()
                : applicationSubject;
            const existingIndex = mergedSubjects.findIndex((subject) => subject.levelGroupId === nextSubject.levelGroupId &&
                subject.subjectId === nextSubject.subjectId);
            if (existingIndex >= 0)
                mergedSubjects[existingIndex] = nextSubject;
            else
                mergedSubjects.push(nextSubject);
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
        await this.userModel.updateOne({ _id: application.userId }, { $set: { role: 'tutor', currentRole: 'tutor', isVerified: true } });
    }
    async migrateLegacyTutorApplications() {
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
                    submittedAt: legacy.createdAt ?? new Date(),
                    reviewedAt: legacy.status === 'pending' ? null : (legacy.updatedAt ?? new Date()),
                    withdrawnAt: null,
                    legacyProfileId
                });
            }
            if (legacy.status === 'approved') {
                legacy.isAggregate = true;
                await legacy.save();
            }
            else {
                await this.tutorProfileModel.deleteOne({ _id: legacy._id });
            }
        }
    }
    isDuplicateKeyError(error) {
        return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
    }
    toSafeUser(user) {
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
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(1, (0, mongoose_1.InjectModel)(profile_schema_1.Profile.name)),
    __param(2, (0, mongoose_1.InjectModel)(tutor_profile_schema_1.TutorProfile.name)),
    __param(3, (0, mongoose_1.InjectModel)(tutor_application_schema_1.TutorApplicationRecord.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        storage_service_1.StorageService])
], UserService);
//# sourceMappingURL=user.service.js.map