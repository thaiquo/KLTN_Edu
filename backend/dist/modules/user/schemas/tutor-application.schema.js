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
exports.TutorApplicationRecordSchema = exports.TutorApplicationRecord = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const tutor_profile_schema_1 = require("./tutor-profile.schema");
let TutorApplicationRecord = class TutorApplicationRecord {
};
exports.TutorApplicationRecord = TutorApplicationRecord;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], TutorApplicationRecord.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '', trim: true }),
    __metadata("design:type", String)
], TutorApplicationRecord.prototype, "bio", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [tutor_profile_schema_1.TutorAvailabilitySchema], default: [] }),
    __metadata("design:type", Array)
], TutorApplicationRecord.prototype, "weeklyAvailability", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [tutor_profile_schema_1.TutorSubjectSchema], default: [] }),
    __metadata("design:type", Array)
], TutorApplicationRecord.prototype, "teachingSubjects", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['pending', 'approved', 'rejected', 'withdrawn'], default: 'pending', index: true }),
    __metadata("design:type", String)
], TutorApplicationRecord.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '', trim: true }),
    __metadata("design:type", String)
], TutorApplicationRecord.prototype, "adminNote", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 1, min: 1 }),
    __metadata("design:type", Number)
], TutorApplicationRecord.prototype, "revision", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: Date.now }),
    __metadata("design:type", Date)
], TutorApplicationRecord.prototype, "submittedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: null }),
    __metadata("design:type", Object)
], TutorApplicationRecord.prototype, "reviewedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: null }),
    __metadata("design:type", Object)
], TutorApplicationRecord.prototype, "withdrawnAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, index: true, sparse: true }),
    __metadata("design:type", String)
], TutorApplicationRecord.prototype, "legacyProfileId", void 0);
exports.TutorApplicationRecord = TutorApplicationRecord = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'tutor_applications' })
], TutorApplicationRecord);
exports.TutorApplicationRecordSchema = mongoose_1.SchemaFactory.createForClass(TutorApplicationRecord);
//# sourceMappingURL=tutor-application.schema.js.map