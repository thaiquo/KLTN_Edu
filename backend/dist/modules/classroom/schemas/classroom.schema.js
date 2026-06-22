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
exports.ClassRoomSchema = exports.ClassRoom = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let ClassRoom = class ClassRoom {
};
exports.ClassRoom = ClassRoom;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], ClassRoom.prototype, "tutorId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], ClassRoom.prototype, "tutorSubjectId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: mongoose_2.Types.ObjectId, ref: 'User' }], default: [] }),
    __metadata("design:type", Array)
], ClassRoom.prototype, "studentIds", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], ClassRoom.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '', trim: true }),
    __metadata("design:type", String)
], ClassRoom.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: mongoose_2.Types.ObjectId, ref: 'Subject' }], default: [] }),
    __metadata("design:type", Array)
], ClassRoom.prototype, "subjectIds", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 0 }),
    __metadata("design:type", Number)
], ClassRoom.prototype, "pricePerSession", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 0 }),
    __metadata("design:type", Number)
], ClassRoom.prototype, "price", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['per_hour', 'per_session', 'per_30_days', 'per_course'] }),
    __metadata("design:type", String)
], ClassRoom.prototype, "priceUnit", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['draft', 'active', 'completed', 'cancelled'], default: 'draft', index: true }),
    __metadata("design:type", String)
], ClassRoom.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 1, min: 1 }),
    __metadata("design:type", Number)
], ClassRoom.prototype, "maxStudents", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '', trim: true }),
    __metadata("design:type", String)
], ClassRoom.prototype, "startDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '', trim: true }),
    __metadata("design:type", String)
], ClassRoom.prototype, "endDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], ClassRoom.prototype, "schedule", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], ClassRoom.prototype, "contractAddress", void 0);
exports.ClassRoom = ClassRoom = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'classrooms' })
], ClassRoom);
exports.ClassRoomSchema = mongoose_1.SchemaFactory.createForClass(ClassRoom);
//# sourceMappingURL=classroom.schema.js.map