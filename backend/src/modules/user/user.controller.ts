import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req,
  UploadedFile, UseGuards, UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { CreateProfileDto } from './dto/create-profile.dto';
import { CreateTutorProfileDto, ReviewTutorItemDto } from './dto/create-tutor-profile.dto';
import { UserService } from './user.service';

type AuthenticatedRequest = Request & { user: JwtPayload };
type EvidenceFile = { originalname: string; mimetype: string; size: number; buffer: Buffer };

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('tutor-applications')
  @UseGuards(JwtAuthGuard)
  listTutorApplications(@Req() request: AuthenticatedRequest) {
    this.assertAdmin(request.user);
    return this.userService.listTutorApplications();
  }

  @Patch('tutor-applications/:profileId/subjects/:subjectId')
  @UseGuards(JwtAuthGuard)
  reviewTutorSubject(
    @Req() request: AuthenticatedRequest,
    @Param('profileId') profileId: string,
    @Param('subjectId') subjectId: string,
    @Body() dto: ReviewTutorItemDto
  ) {
    this.assertAdmin(request.user);
    return this.userService.reviewTutorSubject(profileId, subjectId, dto);
  }

  @Patch('tutor-applications/:profileId/subjects/:subjectId/evidences/:evidenceId')
  @UseGuards(JwtAuthGuard)
  reviewSubjectEvidence(
    @Req() request: AuthenticatedRequest,
    @Param('profileId') profileId: string,
    @Param('subjectId') subjectId: string,
    @Param('evidenceId') evidenceId: string,
    @Body() dto: ReviewTutorItemDto
  ) {
    this.assertAdmin(request.user);
    return this.userService.reviewSubjectEvidence(profileId, subjectId, evidenceId, dto);
  }

  @Get('tutor-applications/:profileId/subjects/:subjectId/evidences/:evidenceId/download-url')
  @UseGuards(JwtAuthGuard)
  getEvidenceDownloadUrl(
    @Req() request: AuthenticatedRequest,
    @Param('profileId') profileId: string,
    @Param('subjectId') subjectId: string,
    @Param('evidenceId') evidenceId: string
  ) {
    this.assertAdmin(request.user);
    return this.userService.getEvidenceDownloadUrl(profileId, subjectId, evidenceId);
  }

  @Get('me/tutor-profile')
  @UseGuards(JwtAuthGuard)
  getOwnTutorProfile(@Req() request: AuthenticatedRequest) {
    return this.userService.getTutorProfile(request.user.sub);
  }

  @Get('me/tutor-evidences/:evidenceId/download-url')
  @UseGuards(JwtAuthGuard)
  getOwnEvidenceDownloadUrl(
    @Req() request: AuthenticatedRequest,
    @Param('evidenceId') evidenceId: string
  ) {
    return this.userService.getOwnEvidenceDownloadUrl(request.user.sub, evidenceId);
  }

  @Post('me/tutor-profile')
  @UseGuards(JwtAuthGuard)
  submitOwnTutorProfile(@Req() request: AuthenticatedRequest, @Body() dto: CreateTutorProfileDto) {
    return this.userService.submitTutorApplication(request.user.sub, dto);
  }

  @Post('me/tutor-evidence-files')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadTutorEvidence(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: EvidenceFile
  ) {
    if (!file) throw new BadRequestException('Evidence file is required');
    return this.userService.storeEvidenceFile(request.user.sub, file);
  }

  @Get()
  getAllUsers() { return this.userService.findAllUsers(); }

  @Get(':userId')
  getUserById(@Param('userId') userId: string) { return this.userService.findUserById(userId); }

  @Get(':userId/profile')
  getProfile(@Param('userId') userId: string) { return this.userService.getProfile(userId); }

  @Post(':userId/profile')
  upsertProfile(@Param('userId') userId: string, @Body() dto: CreateProfileDto) {
    return this.userService.upsertProfile(userId, dto);
  }

  @Get(':userId/tutor-profile')
  getTutorProfile(@Param('userId') userId: string) { return this.userService.getTutorProfile(userId); }

  private assertAdmin(user: JwtPayload) {
    if (user.role !== 'admin') throw new ForbiddenException('Administrator access is required');
  }
}
