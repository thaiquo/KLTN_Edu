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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TutorProfileSchema = exports.TutorProfile = exports.TutorSubjectSchema = exports.TutorSubject = exports.SubjectEvidenceSchema = exports.SubjectEvidence = exports.TutorAvailabilitySchema = exports.TutorAvailability = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let TutorAvailability = class TutorAvailability {
};
exports.TutorAvailability = TutorAvailability;
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 1, max: 7 }),
    __metadata("design:type", Number)
], TutorAvailability.prototype, "dayOfWeek", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ }),
    __metadata("design:type", String)
], TutorAvailability.prototype, "startTime", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ }),
    __metadata("design:type", String)
], TutorAvailability.prototype, "endTime", void 0);
exports.TutorAvailability = TutorAvailability = __decorate([
    (0, mongoose_1.Schema)({ _id: true })
], TutorAvailability);
exports.TutorAvailabilitySchema = mongoose_1.SchemaFactory.createForClass(TutorAvailability);
let SubjectEvidence = class SubjectEvidence {
};
exports.SubjectEvidence = SubjectEvidence;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], SubjectEvidence.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], SubjectEvidence.prototype, "issuer", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], SubjectEvidence.prototype, "issueDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: null }),
    __metadata("design:type", Object)
], SubjectEvidence.prototype, "expiryDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '', trim: true }),
    __metadata("design:type", String)
], SubjectEvidence.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], SubjectEvidence.prototype, "fileUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], SubjectEvidence.prototype, "fileType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['pending', 'approved', 'rejected'], default: 'pending' }),
    __metadata("design:type", String)
], SubjectEvidence.prototype, "verificationStatus", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '', trim: true }),
    __metadata("design:type", String)
], SubjectEvidence.prototype, "adminNote", void 0);
exports.SubjectEvidence = SubjectEvidence = __decorate([
    (0, mongoose_1.Schema)({ _id: true })
], SubjectEvidence);
exports.SubjectEvidenceSchema = mongoose_1.SchemaFactory.createForClass(SubjectEvidence);
let TutorSubject = class TutorSubject {
};
exports.TutorSubject = TutorSubject;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], TutorSubject.prototype, "levelGroupId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], TutorSubject.prototype, "subjectId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], required: true, default: [] }),
    __metadata("design:type", Array)
], TutorSubject.prototype, "teachingLevelIds", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 0 }),
    __metadata("design:type", Number)
], TutorSubject.prototype, "yearsOfExperience", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 1 }),
    __metadata("design:type", Number)
], TutorSubject.prototype, "minPrice", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 1 }),
    __metadata("design:type", Number)
], TutorSubject.prototype, "maxPrice", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['per_hour', 'per_session', 'per_30_days', 'per_course'] }),
    __metadata("design:type", String)
], TutorSubject.prototype, "priceUnit", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: null, min: 1 }),
    __metadata("design:type", Object)
], TutorSubject.prototype, "durationDays", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 1 }),
    __metadata("design:type", Number)
], TutorSubject.prototype, "sessionsPerPeriod", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 1 }),
    __metadata("design:type", Number)
], TutorSubject.prototype, "minutesPerSession", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.SubjectEvidenceSchema], default: [] }),
    __metadata("design:type", Array)
], TutorSubject.prototype, "evidences", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['pending', 'approved', 'rejected'], default: 'pending' }),
    __metadata("design:type", String)
], TutorSubject.prototype, "verificationStatus", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '', trim: true }),
    __metadata("design:type", String)
], TutorSubject.prototype, "adminNote", void 0);
exports.TutorSubject = TutorSubject = __decorate([
    (0, mongoose_1.Schema)({ _id: true, timestamps: true })
], TutorSubject);
exports.TutorSubjectSchema = mongoose_1.SchemaFactory.createForClass(TutorSubject);
let TutorProfile = class TutorProfile {
};
exports.TutorProfile = TutorProfile;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, unique: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], TutorProfile.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '', trim: true }),
    __metadata("design:type", String)
], TutorProfile.prototype, "bio", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.TutorAvailabilitySchema], default: [] }),
    __metadata("design:type", Array)
], TutorProfile.prototype, "weeklyAvailability", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.TutorSubjectSchema], default: [] }),
    __metadata("design:type", Array)
], TutorProfile.prototype, "teachingSubjects", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true }),
    __metadata("design:type", String)
], TutorProfile.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '', trim: true }),
    __metadata("design:type", String)
], TutorProfile.prototype, "adminNote", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], TutorProfile.prototype, "rating", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], TutorProfile.prototype, "totalReviews", void 0);
exports.TutorProfile = TutorProfile = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'tutor_profiles' })
], TutorProfile);
exports.TutorProfileSchema = mongoose_1.SchemaFactory.createForClass(TutorProfile);
//# sourceMappingURL=tutor-profile.schema.js.map