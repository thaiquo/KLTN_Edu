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
exports.ClassroomService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const tutor_profile_schema_1 = require("../user/schemas/tutor-profile.schema");
const classroom_schema_1 = require("./schemas/classroom.schema");
const enrollment_schema_1 = require("./schemas/enrollment.schema");
let ClassroomService = class ClassroomService {
    constructor(classRoomModel, enrollmentModel, tutorProfileModel) {
        this.classRoomModel = classRoomModel;
        this.enrollmentModel = enrollmentModel;
        this.tutorProfileModel = tutorProfileModel;
    }
    async createClassRoom(dto) {
        const tutorProfile = await this.tutorProfileModel.findOne({ userId: dto.tutorId });
        if (!tutorProfile)
            throw new common_1.ForbiddenException('An approved tutor profile is required');
        const tutorSubject = tutorProfile.teachingSubjects.find((subject) => subject._id.toString() === dto.tutorSubjectId);
        if (!tutorSubject || tutorSubject.verificationStatus !== 'approved') {
            throw new common_1.ForbiddenException('Only an approved teaching subject can be used to create a class');
        }
        if (dto.priceUnit !== tutorSubject.priceUnit) {
            throw new common_1.BadRequestException('Class price unit must match the approved subject price unit');
        }
        if (dto.price < tutorSubject.minPrice || dto.price > tutorSubject.maxPrice) {
            throw new common_1.BadRequestException(`Class price must be between ${tutorSubject.minPrice} and ${tutorSubject.maxPrice}`);
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
    async getClassRoomById(classId) {
        const classRoom = await this.classRoomModel.findById(classId).lean();
        if (!classRoom)
            throw new common_1.NotFoundException('ClassRoom not found');
        return classRoom;
    }
    async createEnrollment(dto) {
        const classRoom = await this.classRoomModel.findById(dto.classId).lean();
        if (!classRoom)
            throw new common_1.NotFoundException('Cannot enroll: class not found');
        const created = new this.enrollmentModel({
            classId: dto.classId,
            classRoomId: dto.classRoomId ?? dto.classId,
            studentId: dto.studentId,
            userId: dto.userId ?? dto.studentId,
            joinDate: dto.joinDate ?? new Date().toISOString(),
            status: dto.status ?? 'active'
        });
        await this.classRoomModel.updateOne({ _id: dto.classId }, { $addToSet: { studentIds: dto.studentId } });
        return created.save();
    }
    async getEnrollmentsByClass(classId) {
        return this.enrollmentModel.find({ classId }).lean();
    }
};
exports.ClassroomService = ClassroomService;
exports.ClassroomService = ClassroomService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(classroom_schema_1.ClassRoom.name)),
    __param(1, (0, mongoose_1.InjectModel)(enrollment_schema_1.Enrollment.name)),
    __param(2, (0, mongoose_1.InjectModel)(tutor_profile_schema_1.TutorProfile.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], ClassroomService);
//# sourceMappingURL=classroom.service.js.map