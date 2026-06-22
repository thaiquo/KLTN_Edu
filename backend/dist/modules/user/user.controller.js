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
exports.UserController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const create_profile_dto_1 = require("./dto/create-profile.dto");
const create_tutor_profile_dto_1 = require("./dto/create-tutor-profile.dto");
const user_service_1 = require("./user.service");
let UserController = class UserController {
    constructor(userService) {
        this.userService = userService;
    }
    listTutorApplications(request) {
        this.assertAdmin(request.user);
        return this.userService.listTutorApplications();
    }
    reviewTutorSubject(request, profileId, subjectId, dto) {
        this.assertAdmin(request.user);
        return this.userService.reviewTutorSubject(profileId, subjectId, dto);
    }
    reviewSubjectEvidence(request, profileId, subjectId, evidenceId, dto) {
        this.assertAdmin(request.user);
        return this.userService.reviewSubjectEvidence(profileId, subjectId, evidenceId, dto);
    }
    getOwnTutorProfile(request) {
        return this.userService.getTutorProfile(request.user.sub);
    }
    submitOwnTutorProfile(request, dto) {
        return this.userService.submitTutorApplication(request.user.sub, dto);
    }
    uploadTutorEvidence(file) {
        if (!file)
            throw new common_1.ForbiddenException('Evidence file is required');
        return this.userService.storeEvidenceFile(file);
    }
    getAllUsers() { return this.userService.findAllUsers(); }
    getUserById(userId) { return this.userService.findUserById(userId); }
    getProfile(userId) { return this.userService.getProfile(userId); }
    upsertProfile(userId, dto) {
        return this.userService.upsertProfile(userId, dto);
    }
    getTutorProfile(userId) { return this.userService.getTutorProfile(userId); }
    assertAdmin(user) {
        if (user.role !== 'admin')
            throw new common_1.ForbiddenException('Administrator access is required');
    }
};
exports.UserController = UserController;
__decorate([
    (0, common_1.Get)('tutor-applications'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "listTutorApplications", null);
__decorate([
    (0, common_1.Patch)('tutor-applications/:profileId/subjects/:subjectId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('profileId')),
    __param(2, (0, common_1.Param)('subjectId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, create_tutor_profile_dto_1.ReviewTutorItemDto]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "reviewTutorSubject", null);
__decorate([
    (0, common_1.Patch)('tutor-applications/:profileId/subjects/:subjectId/evidences/:evidenceId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('profileId')),
    __param(2, (0, common_1.Param)('subjectId')),
    __param(3, (0, common_1.Param)('evidenceId')),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, create_tutor_profile_dto_1.ReviewTutorItemDto]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "reviewSubjectEvidence", null);
__decorate([
    (0, common_1.Get)('me/tutor-profile'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "getOwnTutorProfile", null);
__decorate([
    (0, common_1.Post)('me/tutor-profile'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_tutor_profile_dto_1.CreateTutorProfileDto]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "submitOwnTutorProfile", null);
__decorate([
    (0, common_1.Post)('me/tutor-evidence-files'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: 5 * 1024 * 1024 } })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "uploadTutorEvidence", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], UserController.prototype, "getAllUsers", null);
__decorate([
    (0, common_1.Get)(':userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "getUserById", null);
__decorate([
    (0, common_1.Get)(':userId/profile'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Post)(':userId/profile'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_profile_dto_1.CreateProfileDto]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "upsertProfile", null);
__decorate([
    (0, common_1.Get)(':userId/tutor-profile'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "getTutorProfile", null);
exports.UserController = UserController = __decorate([
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [user_service_1.UserService])
], UserController);
//# sourceMappingURL=user.controller.js.map