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
exports.EngagementService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const document_schema_1 = require("./schemas/document.schema");
const notification_schema_1 = require("./schemas/notification.schema");
const review_schema_1 = require("./schemas/review.schema");
let EngagementService = class EngagementService {
    constructor(reviewModel, notificationModel, documentModel) {
        this.reviewModel = reviewModel;
        this.notificationModel = notificationModel;
        this.documentModel = documentModel;
    }
    createReview(dto) {
        return this.reviewModel.create({
            ...dto,
            comment: dto.comment ?? ''
        });
    }
    listReviewsByClass(classId) {
        return this.reviewModel.find({ classId }).sort({ createdAt: -1 }).lean();
    }
    createNotification(dto) {
        return this.notificationModel.create({
            ...dto,
            isRead: dto.isRead ?? false
        });
    }
    listNotificationsByUser(userId) {
        return this.notificationModel.find({ userId }).sort({ createdAt: -1 }).lean();
    }
    createDocument(dto) {
        return this.documentModel.create({
            ...dto,
            fileUrl: dto.fileUrl ?? [],
            description: dto.description ?? ''
        });
    }
    listDocumentsByClass(classId) {
        return this.documentModel.find({ classId }).sort({ createdAt: -1 }).lean();
    }
};
exports.EngagementService = EngagementService;
exports.EngagementService = EngagementService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(review_schema_1.Review.name)),
    __param(1, (0, mongoose_1.InjectModel)(notification_schema_1.Notification.name)),
    __param(2, (0, mongoose_1.InjectModel)(document_schema_1.DocumentEntity.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], EngagementService);
//# sourceMappingURL=engagement.service.js.map