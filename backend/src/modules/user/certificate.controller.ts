import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { CertificateService } from './certificate.service';
import { AdminCertificateActionDto, ApplyCertificateDto } from './dto/certificate.dto';

type AuthRequest = Request & { user: JwtPayload };

/**
 * Tất cả các endpoint liên quan đến chứng chỉ gia sư.
 *
 * Gia sư (tutor / student đang apply):
 *   POST   /certificates/me                     → nộp chứng chỉ mới
 *   PATCH  /certificates/me/:certId             → cập nhật (kể cả khi đang pending)
 *   GET    /certificates/me                     → danh sách chứng chỉ cá nhân
 *   PATCH  /certificates/me/:certId/confirm     → xác nhận lại chứng chỉ vĩnh viễn (3 năm)
 *   GET    /certificates/me/:certId/download-url → download file của chứng chỉ cá nhân
 *
 * Public:
 *   GET    /certificates/tutor/:tutorId/active  → chứng chỉ đang hiệu lực của gia sư
 *
 * Admin:
 *   GET    /certificates/pending                → danh sách chờ duyệt
 *   GET    /certificates                        → toàn bộ chứng chỉ
 *   PATCH  /certificates/:certId/approve        → duyệt
 *   PATCH  /certificates/:certId/reject         → từ chối
 *   PATCH  /certificates/:certId/request-update → yêu cầu cập nhật minh chứng
 *   PATCH  /certificates/:certId/revoke         → thu hồi xác minh
 *   GET    /certificates/:certId/download-url   → download file (admin)
 */
@Controller('certificates')
export class CertificateController {
  constructor(private readonly certService: CertificateService) {}

  // ─── Tutor endpoints ──────────────────────────────────────

  @Post('me')
  @UseGuards(JwtAuthGuard)
  applyCertificate(@Req() req: AuthRequest, @Body() dto: ApplyCertificateDto) {
    return this.certService.applyCertificate(req.user.sub, dto);
  }

  @Patch('me/:certId')
  @UseGuards(JwtAuthGuard)
  updateCertificate(
    @Req() req: AuthRequest,
    @Param('certId') certId: string,
    @Body() dto: ApplyCertificateDto
  ) {
    return this.certService.updateCertificate(req.user.sub, certId, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  listOwnCertificates(@Req() req: AuthRequest) {
    return this.certService.listOwnCertificates(req.user.sub);
  }

  @Patch('me/:certId/confirm')
  @UseGuards(JwtAuthGuard)
  confirmCertificateAccuracy(@Req() req: AuthRequest, @Param('certId') certId: string) {
    return this.certService.confirmCertificateAccuracy(req.user.sub, certId);
  }

  @Get('me/:certId/download-url')
  @UseGuards(JwtAuthGuard)
  getOwnCertificateDownloadUrl(@Req() req: AuthRequest, @Param('certId') certId: string) {
    return this.certService.getOwnCertificateDownloadUrl(req.user.sub, certId);
  }

  // ─── Public endpoint ──────────────────────────────────────

  @Get('tutor/:tutorId/active')
  getActiveCertificates(@Param('tutorId') tutorId: string) {
    return this.certService.getActiveCertificatesForTutor(tutorId);
  }

  // ─── Admin endpoints ──────────────────────────────────────

  @Get('pending')
  @UseGuards(JwtAuthGuard)
  listPendingCertificates(@Req() req: AuthRequest) {
    this.assertAdmin(req.user);
    return this.certService.listPendingCertificates();
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  listAllCertificates(@Req() req: AuthRequest) {
    this.assertAdmin(req.user);
    return this.certService.listAllCertificates();
  }

  @Patch(':certId/approve')
  @UseGuards(JwtAuthGuard)
  approveCertificate(
    @Req() req: AuthRequest,
    @Param('certId') certId: string,
    @Body() dto: AdminCertificateActionDto
  ) {
    this.assertAdmin(req.user);
    return this.certService.approveCertificate(certId, dto.adminNote);
  }

  @Patch(':certId/reject')
  @UseGuards(JwtAuthGuard)
  rejectCertificate(
    @Req() req: AuthRequest,
    @Param('certId') certId: string,
    @Body() dto: AdminCertificateActionDto
  ) {
    this.assertAdmin(req.user);
    return this.certService.rejectCertificate(certId, dto.adminNote);
  }

  @Patch(':certId/request-update')
  @UseGuards(JwtAuthGuard)
  requestCertificateUpdate(
    @Req() req: AuthRequest,
    @Param('certId') certId: string,
    @Body() dto: AdminCertificateActionDto
  ) {
    this.assertAdmin(req.user);
    return this.certService.requestCertificateUpdate(certId, dto.adminNote);
  }

  @Patch(':certId/revoke')
  @UseGuards(JwtAuthGuard)
  revokeCertificate(
    @Req() req: AuthRequest,
    @Param('certId') certId: string,
    @Body() dto: AdminCertificateActionDto
  ) {
    this.assertAdmin(req.user);
    return this.certService.revokeCertificate(certId, dto.adminNote);
  }

  @Get(':certId/download-url')
  @UseGuards(JwtAuthGuard)
  getCertificateDownloadUrl(@Req() req: AuthRequest, @Param('certId') certId: string) {
    this.assertAdmin(req.user);
    return this.certService.getCertificateDownloadUrl(certId);
  }

  // ─── Private guard ────────────────────────────────────────

  private assertAdmin(user: JwtPayload) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Administrator access is required');
    }
  }
}
