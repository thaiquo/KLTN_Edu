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
exports.ClassroomController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const classroom_service_1 = require("./classroom.service");
const create_classroom_dto_1 = require("./dto/create-classroom.dto");
const create_enrollment_dto_1 = require("./dto/create-enrollment.dto");
let ClassroomController = class ClassroomController {
    constructor(classroomService) {
        this.classroomService = classroomService;
    }
    createClassRoom(request, dto) {
        if (request.user.sub !== dto.tutorId && request.user.role !== 'admin') {
            throw new common_1.ForbiddenException('You can only create classes for your own tutor account');
        }
        return this.classroomService.createClassRoom(dto);
    }
    getAllClassRooms() {
        return this.classroomService.getAllClassRooms();
    }
    getClassRoomById(classId) {
        return this.classroomService.getClassRoomById(classId);
    }
    createEnrollment(dto) {
        return this.classroomService.createEnrollment(dto);
    }
    getEnrollmentsByClass(classId) {
        return this.classroomService.getEnrollmentsByClass(classId);
    }
};
exports.ClassroomController = ClassroomController;
__decorate([
    (0, common_1.Post)('classrooms'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_classroom_dto_1.CreateClassRoomDto]),
    __metadata("design:returntype", void 0)
], ClassroomController.prototype, "createClassRoom", null);
__decorate([
    (0, common_1.Get)('classrooms'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ClassroomController.prototype, "getAllClassRooms", null);
__decorate([
    (0, common_1.Get)('classrooms/:classId'),
    __param(0, (0, common_1.Param)('classId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ClassroomController.prototype, "getClassRoomById", null);
__decorate([
    (0, common_1.Post)('enrollments'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_enrollment_dto_1.CreateEnrollmentDto]),
    __metadata("design:returntype", void 0)
], ClassroomController.prototype, "createEnrollment", null);
__decorate([
    (0, common_1.Get)('classrooms/:classId/enrollments'),
    __param(0, (0, common_1.Param)('classId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ClassroomController.prototype, "getEnrollmentsByClass", null);
exports.ClassroomController = ClassroomController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [classroom_service_1.ClassroomService])
], ClassroomController);
//# sourceMappingURL=classroom.controller.js.map