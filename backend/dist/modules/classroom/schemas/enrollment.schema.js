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
exports.EnrollmentSchema = exports.Enrollment = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let Enrollment = class Enrollment {
};
exports.Enrollment = Enrollment;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Enrollment.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'ClassRoom', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Enrollment.prototype, "classRoomId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'ClassRoom', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Enrollment.prototype, "classId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Enrollment.prototype, "studentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: () => new Date().toISOString() }),
    __metadata("design:type", String)
], Enrollment.prototype, "joinDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['active', 'pending', 'cancelled', 'completed'], default: 'active', index: true }),
    __metadata("design:type", String)
], Enrollment.prototype, "status", void 0);
exports.Enrollment = Enrollment = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'enrollments' })
], Enrollment);
exports.EnrollmentSchema = mongoose_1.SchemaFactory.createForClass(Enrollment);
//# sourceMappingURL=enrollment.schema.js.map