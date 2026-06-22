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
exports.SessionService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const attendance_schema_1 = require("./schemas/attendance.schema");
const session_schema_1 = require("./schemas/session.schema");
let SessionService = class SessionService {
    constructor(sessionModel, attendanceModel) {
        this.sessionModel = sessionModel;
        this.attendanceModel = attendanceModel;
    }
    async createSession(dto) {
        const created = new this.sessionModel({
            classId: dto.classId,
            date: dto.date,
            startTime: dto.startTime ?? '',
            endTime: dto.endTime ?? '',
            link: dto.link ?? '',
            status: dto.status ?? 'scheduled'
        });
        return created.save();
    }
    async getAllSessions() {
        return this.sessionModel.find().lean();
    }
    async getSessionById(sessionId) {
        const session = await this.sessionModel.findById(sessionId).lean();
        if (!session) {
            throw new common_1.NotFoundException('Session not found');
        }
        return session;
    }
    async markSessionCompleted(sessionId) {
        const updated = await this.sessionModel
            .findByIdAndUpdate(sessionId, { status: 'completed' }, { new: true })
            .lean();
        if (!updated) {
            throw new common_1.NotFoundException('Session not found');
        }
        return updated;
    }
    async createAttendance(dto) {
        const session = await this.sessionModel.findById(dto.sessionId).lean();
        if (!session) {
            throw new common_1.NotFoundException('Cannot create attendance: session not found');
        }
        const created = new this.attendanceModel({
            sessionId: dto.sessionId,
            userId: dto.userId,
            present: dto.present,
            checkinDate: dto.checkinDate ?? new Date().toISOString(),
            type: dto.type ?? 'student'
        });
        return created.save();
    }
    async getAttendancesBySession(sessionId) {
        return this.attendanceModel.find({ sessionId }).lean();
    }
};
exports.SessionService = SessionService;
exports.SessionService = SessionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(session_schema_1.Session.name)),
    __param(1, (0, mongoose_1.InjectModel)(attendance_schema_1.Attendance.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], SessionService);
//# sourceMappingURL=session.service.js.map