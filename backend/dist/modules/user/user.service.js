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
const promises_1 = require("fs/promises");
const mongoose_2 = require("mongoose");
const path_1 = require("path");
const crypto_1 = require("crypto");
const profile_schema_1 = require("./schemas/profile.schema");
const tutor_profile_schema_1 = require("./schemas/tutor-profile.schema");
const user_schema_1 = require("./schemas/user.schema");
let UserService = class UserService {
    constructor(userModel, profileModel, tutorProfileModel) {
        this.userModel = userModel;
        this.profileModel = profileModel;
        this.tutorProfileModel = tutorProfileModel;
    }
    async createStudent(input) {
        try {
            return await this.userModel.create({
                fullName: input.fullName.trim(),
                email: input.email.toLowerCase().trim(),
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
    async findAllUsers() { return this.userModel.find().select('-password').lean(); }
    async findUserById(userId) {
        const user = await this.userModel.findById(userId).lean();
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return this.toSafeUser(user);
    }
    findSafeUserById(userId) { return this.findUserById(userId); }
    async upsertProfile(userId, dto) {
        return this.profileModel.findOneAndUpdate({ userId }, { $set: { name: dto.name, avatar: dto.avatar ?? '', address: dto.address ?? '', gender: dto.gender ?? '', phone: dto.phone ?? '', dateOfBirth: dto.dateOfBirth ?? '', bio: dto.bio ?? '' } }, { upsert: true, new: true }).lean();
    }
    async submitTutorApplication(userId, dto) {
        await this.findUserById(userId);
        this.validateTutorApplication(dto);
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
        return this.tutorProfileModel.findOneAndUpdate({ userId }, {
            $set: {
                bio: dto.bio.trim(),
                weeklyAvailability: dto.weeklyAvailability,
                teachingSubjects,
                status: 'pending',
                adminNote: ''
            },
            $setOnInsert: { rating: 0, totalReviews: 0 }
        }, { upsert: true, new: true, runValidators: true }).lean();
    }
    getTutorProfile(userId) {
        return this.tutorProfileModel.findOne({ userId }).lean();
    }
    listTutorApplications() {
        return this.tutorProfileModel
            .find({ status: { $in: ['pending', 'approved', 'rejected'] } })
            .populate('userId', 'fullName email role currentRole')
            .sort({ updatedAt: -1 })
            .lean();
    }
    async reviewTutorSubject(profileId, subjectId, dto) {
        const profile = await this.tutorProfileModel.findById(profileId);
        if (!profile)
            throw new common_1.NotFoundException('Tutor application not found');
        const subject = profile.teachingSubjects.id(subjectId);
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
        await this.recalculateApplicationStatus(profile);
        return profile.toObject();
    }
    async reviewSubjectEvidence(profileId, subjectId, evidenceId, dto) {
        const profile = await this.tutorProfileModel.findById(profileId);
        if (!profile)
            throw new common_1.NotFoundException('Tutor application not found');
        const subject = profile.teachingSubjects.id(subjectId);
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
        await this.recalculateApplicationStatus(profile);
        return profile.toObject();
    }
    async storeEvidenceFile(file) {
        const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
        if (!allowed.includes(file.mimetype)) {
            throw new common_1.BadRequestException('Only PDF, PNG and JPG files are accepted');
        }
        const uploadDirectory = (0, path_1.join)(process.cwd(), 'uploads', 'tutor-evidence');
        await (0, promises_1.mkdir)(uploadDirectory, { recursive: true });
        const safeExtension = (0, path_1.extname)(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
        const filename = `${(0, crypto_1.randomUUID)()}${safeExtension}`;
        await (0, promises_1.writeFile)((0, path_1.join)(uploadDirectory, filename), file.buffer);
        return { fileUrl: `/uploads/tutor-evidence/${filename}`, fileType: file.mimetype };
    }
    getProfile(userId) { return this.profileModel.findOne({ userId }).lean(); }
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
            if (subjectKeys.has(key))
                throw new common_1.BadRequestException('The same teaching subject cannot be added twice');
            subjectKeys.add(key);
            if (subject.maxPrice < subject.minPrice) {
                throw new common_1.BadRequestException('Maximum price must be greater than or equal to minimum price');
            }
            if (['per_30_days', 'per_course'].includes(subject.priceUnit) && !subject.durationDays && subject.priceUnit !== 'per_30_days') {
                throw new common_1.BadRequestException('Duration is required for course pricing');
            }
        }
    }
    async recalculateApplicationStatus(profile) {
        const statuses = profile.teachingSubjects.map((subject) => subject.verificationStatus);
        if (statuses.length > 0 && statuses.every((status) => status === 'approved')) {
            profile.status = 'approved';
            await this.userModel.updateOne({ _id: profile.userId }, { $set: { role: 'tutor', currentRole: 'tutor', isVerified: true } });
        }
        else if (statuses.some((status) => status === 'rejected')) {
            profile.status = 'rejected';
        }
        else {
            profile.status = 'pending';
        }
        await profile.save();
    }
    isDuplicateKeyError(error) {
        return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
    }
    toSafeUser(user) {
        return {
            id: user._id.toString(),
            fullName: user.fullName,
            email: user.email,
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
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], UserService);
//# sourceMappingURL=user.service.js.map