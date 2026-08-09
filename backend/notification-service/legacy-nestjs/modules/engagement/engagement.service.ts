import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { DocumentEntity, DocumentEntityDocument } from './schemas/document.schema';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { Review, ReviewDocument } from './schemas/review.schema';

@Injectable()
export class EngagementService {
  constructor(
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(DocumentEntity.name) private readonly documentModel: Model<DocumentEntityDocument>
  ) {}

  createReview(dto: CreateReviewDto) {
    return this.reviewModel.create({
      ...dto,
      comment: dto.comment ?? ''
    });
  }

  listReviewsByClass(classId: string) {
    return this.reviewModel.find({ classId }).sort({ createdAt: -1 }).lean();
  }

  createNotification(dto: CreateNotificationDto) {
    return this.notificationModel.create({
      ...dto,
      isRead: dto.isRead ?? false
    });
  }

  listNotificationsByUser(userId: string) {
    return this.notificationModel.find({ userId }).sort({ createdAt: -1 }).lean();
  }

  createDocument(dto: CreateDocumentDto) {
    return this.documentModel.create({
      ...dto,
      fileUrl: dto.fileUrl ?? [],
      description: dto.description ?? ''
    });
  }

  listDocumentsByClass(classId: string) {
    return this.documentModel.find({ classId }).sort({ createdAt: -1 }).lean();
  }
}
