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
exports.EngagementController = void 0;
const common_1 = require("@nestjs/common");
const create_document_dto_1 = require("./dto/create-document.dto");
const create_notification_dto_1 = require("./dto/create-notification.dto");
const create_review_dto_1 = require("./dto/create-review.dto");
const engagement_service_1 = require("./engagement.service");
let EngagementController = class EngagementController {
    constructor(engagementService) {
        this.engagementService = engagementService;
    }
    createReview(dto) {
        return this.engagementService.createReview(dto);
    }
    listReviewsByClass(classId) {
        return this.engagementService.listReviewsByClass(classId);
    }
    createNotification(dto) {
        return this.engagementService.createNotification(dto);
    }
    listNotificationsByUser(userId) {
        return this.engagementService.listNotificationsByUser(userId);
    }
    createDocument(dto) {
        return this.engagementService.createDocument(dto);
    }
    listDocumentsByClass(classId) {
        return this.engagementService.listDocumentsByClass(classId);
    }
};
exports.EngagementController = EngagementController;
__decorate([
    (0, common_1.Post)('reviews'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_review_dto_1.CreateReviewDto]),
    __metadata("design:returntype", void 0)
], EngagementController.prototype, "createReview", null);
__decorate([
    (0, common_1.Get)('classrooms/:classId/reviews'),
    __param(0, (0, common_1.Param)('classId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EngagementController.prototype, "listReviewsByClass", null);
__decorate([
    (0, common_1.Post)('notifications'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_notification_dto_1.CreateNotificationDto]),
    __metadata("design:returntype", void 0)
], EngagementController.prototype, "createNotification", null);
__decorate([
    (0, common_1.Get)('users/:userId/notifications'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EngagementController.prototype, "listNotificationsByUser", null);
__decorate([
    (0, common_1.Post)('documents'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_document_dto_1.CreateDocumentDto]),
    __metadata("design:returntype", void 0)
], EngagementController.prototype, "createDocument", null);
__decorate([
    (0, common_1.Get)('classrooms/:classId/documents'),
    __param(0, (0, common_1.Param)('classId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EngagementController.prototype, "listDocumentsByClass", null);
exports.EngagementController = EngagementController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [engagement_service_1.EngagementService])
], EngagementController);
//# sourceMappingURL=engagement.controller.js.map