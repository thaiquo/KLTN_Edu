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
exports.AssignmentService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const assignment_schema_1 = require("./schemas/assignment.schema");
const submission_schema_1 = require("./schemas/submission.schema");
let AssignmentService = class AssignmentService {
    constructor(assignmentModel, submissionModel) {
        this.assignmentModel = assignmentModel;
        this.submissionModel = submissionModel;
    }
    async createAssignment(dto) {
        const created = new this.assignmentModel({
            classId: dto.classId,
            title: dto.title,
            description: dto.description ?? '',
            fileUrl: dto.fileUrl ?? [],
            dueDate: dto.dueDate ?? '',
            content: dto.content ?? ''
        });
        return created.save();
    }
    async getAllAssignments() {
        return this.assignmentModel.find().lean();
    }
    async getAssignmentById(assignmentId) {
        const assignment = await this.assignmentModel.findById(assignmentId).lean();
        if (!assignment) {
            throw new common_1.NotFoundException('Assignment not found');
        }
        return assignment;
    }
    async createSubmission(dto) {
        const assignment = await this.assignmentModel.findById(dto.assignmentId).lean();
        if (!assignment) {
            throw new common_1.NotFoundException('Cannot create submission: assignment not found');
        }
        const created = new this.submissionModel({
            assignmentId: dto.assignmentId,
            studentId: dto.studentId,
            content: dto.content ?? '',
            fileUrl: dto.fileUrl ?? [],
            score: dto.score ?? 0,
            feedback: dto.feedback ?? ''
        });
        return created.save();
    }
    async getSubmissionsByAssignment(assignmentId) {
        return this.submissionModel.find({ assignmentId }).lean();
    }
};
exports.AssignmentService = AssignmentService;
exports.AssignmentService = AssignmentService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(assignment_schema_1.Assignment.name)),
    __param(1, (0, mongoose_1.InjectModel)(submission_schema_1.Submission.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], AssignmentService);
//# sourceMappingURL=assignment.service.js.map