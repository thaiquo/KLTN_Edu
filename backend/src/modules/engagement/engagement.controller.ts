import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { EngagementService } from './engagement.service';

@Controller()
export class EngagementController {
  constructor(private readonly engagementService: EngagementService) {}

  @Post('reviews')
  createReview(@Body() dto: CreateReviewDto) {
    return this.engagementService.createReview(dto);
  }

  @Get('classrooms/:classId/reviews')
  listReviewsByClass(@Param('classId') classId: string) {
    return this.engagementService.listReviewsByClass(classId);
  }

  @Post('notifications')
  createNotification(@Body() dto: CreateNotificationDto) {
    return this.engagementService.createNotification(dto);
  }

  @Get('users/:userId/notifications')
  listNotificationsByUser(@Param('userId') userId: string) {
    return this.engagementService.listNotificationsByUser(userId);
  }

  @Post('documents')
  createDocument(@Body() dto: CreateDocumentDto) {
    return this.engagementService.createDocument(dto);
  }

  @Get('classrooms/:classId/documents')
  listDocumentsByClass(@Param('classId') classId: string) {
    return this.engagementService.listDocumentsByClass(classId);
  }
}
