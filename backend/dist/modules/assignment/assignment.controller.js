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
exports.AssignmentController = void 0;
const common_1 = require("@nestjs/common");
const create_assignment_dto_1 = require("./dto/create-assignment.dto");
const create_submission_dto_1 = require("./dto/create-submission.dto");
const assignment_service_1 = require("./assignment.service");
let AssignmentController = class AssignmentController {
    constructor(assignmentService) {
        this.assignmentService = assignmentService;
    }
    createAssignment(dto) {
        return this.assignmentService.createAssignment(dto);
    }
    getAllAssignments() {
        return this.assignmentService.getAllAssignments();
    }
    getAssignmentById(assignmentId) {
        return this.assignmentService.getAssignmentById(assignmentId);
    }
    createSubmission(dto) {
        return this.assignmentService.createSubmission(dto);
    }
    getSubmissionsByAssignment(assignmentId) {
        return this.assignmentService.getSubmissionsByAssignment(assignmentId);
    }
};
exports.AssignmentController = AssignmentController;
__decorate([
    (0, common_1.Post)('assignments'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_assignment_dto_1.CreateAssignmentDto]),
    __metadata("design:returntype", void 0)
], AssignmentController.prototype, "createAssignment", null);
__decorate([
    (0, common_1.Get)('assignments'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AssignmentController.prototype, "getAllAssignments", null);
__decorate([
    (0, common_1.Get)('assignments/:assignmentId'),
    __param(0, (0, common_1.Param)('assignmentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AssignmentController.prototype, "getAssignmentById", null);
__decorate([
    (0, common_1.Post)('submissions'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_submission_dto_1.CreateSubmissionDto]),
    __metadata("design:returntype", void 0)
], AssignmentController.prototype, "createSubmission", null);
__decorate([
    (0, common_1.Get)('assignments/:assignmentId/submissions'),
    __param(0, (0, common_1.Param)('assignmentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AssignmentController.prototype, "getSubmissionsByAssignment", null);
exports.AssignmentController = AssignmentController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [assignment_service_1.AssignmentService])
], AssignmentController);
//# sourceMappingURL=assignment.controller.js.map