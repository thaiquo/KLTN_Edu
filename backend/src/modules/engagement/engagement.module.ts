import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EngagementController } from './engagement.controller';
import { EngagementService } from './engagement.service';
import { DocumentEntity, DocumentEntitySchema } from './schemas/document.schema';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { Review, ReviewSchema } from './schemas/review.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: DocumentEntity.name, schema: DocumentEntitySchema }
    ])
  ],
  controllers: [EngagementController],
  providers: [EngagementService],
  exports: [EngagementService]
})
export class EngagementModule {}
