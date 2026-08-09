import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';

import { StorageService } from '../../common/storage/storage.service';
import { Notification, NotificationDocument } from '../engagement/schemas/notification.schema';
import { SocketService } from '../socket/socket.service';
import { ApplyCertificateDto } from './dto/certificate.dto';
import { Certificate, CertificateDocument, CertificateStatus } from './schemas/certificate.schema';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);

  constructor(
    @InjectModel(Certificate.name) private readonly certModel: Model<CertificateDocument>,
    @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly storageService: StorageService,
    private readonly socketService: SocketService       // ← realtime
  ) {}

  // ═══════════════════════════════════════════════════════════
  //  TUTOR: nộp chứng chỉ mới
  // ═══════════════════════════════════════════════════════════
  async applyCertificate(userId: string, dto: ApplyCertificateDto): Promise<CertificateDocument> {
    this.validateCertificateDto(dto);
    this.assertFileOwnership(dto.fileKey, userId);

    const historyEntry = this.buildHistoryEntry(dto, 1);

    const cert = await this.certModel.create({
      tutorId: new Types.ObjectId(userId),
      ...this.buildCertFields(dto),
      status: 'pending',
      adminNote: '',
      revision: 1,
      history: [historyEntry],
      submittedAt: new Date()
    });

    // 🔔 Thông báo realtime cho admin: có chứng chỉ mới cần duyệt
    this.socketService.emitToAdmin('certificate:new', {
      certId:   cert._id.toString(),
      tutorId:  userId,
      title:    cert.title,
      issuer:   cert.issuer,
      revision: 1,
      submittedAt: cert.submittedAt
    });

    return cert;
  }

  // ═══════════════════════════════════════════════════════════
  //  TUTOR: cập nhật chứng chỉ (kể cả khi đang pending)
  //  Mỗi lần update → ghi lịch sử, tăng revision, reset về pending
  // ═══════════════════════════════════════════════════════════
  async updateCertificate(
    userId: string,
    certId: string,
    dto: ApplyCertificateDto
  ): Promise<object> {
    this.validateCertificateDto(dto);
    this.assertFileOwnership(dto.fileKey, userId);

    const cert = await this.certModel.findOne({ _id: certId, tutorId: userId });
    if (!cert) throw new NotFoundException('Certificate not found');

    const editableStatuses: CertificateStatus[] = ['pending', 'rejected', 'needs_update'];
    if (!editableStatuses.includes(cert.status)) {
      throw new BadRequestException(
        `Cannot update a certificate with status "${cert.status}". ` +
        `Only pending, rejected or needs_update certificates can be resubmitted.`
      );
    }

    const newRevision = cert.revision + 1;
    const historyEntry = this.buildHistoryEntry(dto, newRevision);

    cert.set({
      ...this.buildCertFields(dto),
      status: 'pending',
      adminNote: '',
      revision: newRevision,
      submittedAt: new Date()
    });
    (cert.history as any[]).push(historyEntry);
    await cert.save();

    // 🔔 Thông báo realtime cho admin: gia sư đã cập nhật chứng chỉ
    this.socketService.emitToAdmin('certificate:updated', {
      certId:   cert._id.toString(),
      tutorId:  userId,
      title:    cert.title,
      revision: newRevision,
      submittedAt: cert.submittedAt
    });

    return cert.toObject();
  }

  // ═══════════════════════════════════════════════════════════
  //  TUTOR: danh sách chứng chỉ cá nhân (kèm history)
  // ═══════════════════════════════════════════════════════════
  listOwnCertificates(userId: string) {
    return this.certModel
      .find({ tutorId: new Types.ObjectId(userId) })
      .sort({ submittedAt: -1 })
      .lean();
  }

  // ═══════════════════════════════════════════════════════════
  //  TUTOR: xác nhận lại chứng chỉ vĩnh viễn (định kỳ 3 năm)
  // ═══════════════════════════════════════════════════════════
  async confirmCertificateAccuracy(userId: string, certId: string): Promise<object> {
    const cert = await this.certModel.findOne({ _id: certId, tutorId: userId });
    if (!cert) throw new NotFoundException('Certificate not found');
    if (!cert.isPermanent) {
      throw new BadRequestException('Only permanent certificates require periodic confirmation');
    }
    if (!['approved', 'needs_update'].includes(cert.status)) {
      throw new BadRequestException(
        `Cannot confirm a certificate with status "${cert.status}"`
      );
    }

    cert.lastConfirmedAt = new Date();
    if (cert.status === 'needs_update') {
      cert.status = 'approved';
      cert.adminNote = '';
    }
    await cert.save();
    return cert.toObject();
  }

  // ═══════════════════════════════════════════════════════════
  //  PUBLIC: chứng chỉ đang hiệu lực hiển thị trên hồ sơ gia sư
  // ═══════════════════════════════════════════════════════════
  getActiveCertificatesForTutor(tutorId: string) {
    return this.certModel
      .find({ tutorId: new Types.ObjectId(tutorId), status: 'approved' })
      .select('-history -fileKey')
      .lean();
  }

  // ═══════════════════════════════════════════════════════════
  //  ADMIN: danh sách chứng chỉ đang chờ duyệt
  // ═══════════════════════════════════════════════════════════
  listPendingCertificates() {
    return this.certModel
      .find({ status: 'pending' })
      .populate('tutorId', 'fullName email phone')
      .sort({ submittedAt: -1 })
      .lean();
  }

  // ═══════════════════════════════════════════════════════════
  //  ADMIN: toàn bộ chứng chỉ
  // ═══════════════════════════════════════════════════════════
  listAllCertificates() {
    return this.certModel
      .find()
      .populate('tutorId', 'fullName email phone')
      .sort({ submittedAt: -1 })
      .lean();
  }

  // ═══════════════════════════════════════════════════════════
  //  ADMIN: duyệt chứng chỉ
  // ═══════════════════════════════════════════════════════════
  async approveCertificate(certId: string, adminNote?: string): Promise<object> {
    const cert = await this.findCertOrFail(certId);
    if (cert.status !== 'pending') {
      throw new BadRequestException('Only pending certificates can be approved');
    }

    cert.status = 'approved';
    cert.adminNote = adminNote?.trim() ?? '';
    cert.approvedAt = new Date();
    cert.lastConfirmedAt = new Date();
    await cert.save();

    const notification = {
      type: 'certificate_approved',
      title: 'Chứng chỉ đã được duyệt',
      message: `Chứng chỉ "${cert.title}" của bạn đã được admin xác minh thành công.`
    };
    await this.sendNotification(cert.tutorId.toString(), notification);

    // 🔔 Realtime: đẩy ngay về client của tutor
    this.socketService.emitToUser(cert.tutorId.toString(), 'certificate:approved', {
      certId:    cert._id.toString(),
      certTitle: cert.title,
      adminNote: cert.adminNote,
      ...notification
    });

    return cert.toObject();
  }

  // ═══════════════════════════════════════════════════════════
  //  ADMIN: từ chối chứng chỉ
  // ═══════════════════════════════════════════════════════════
  async rejectCertificate(certId: string, adminNote?: string): Promise<object> {
    const cert = await this.findCertOrFail(certId);
    if (cert.status !== 'pending') {
      throw new BadRequestException('Only pending certificates can be rejected');
    }

    cert.status = 'rejected';
    cert.adminNote = adminNote?.trim() ?? '';
    await cert.save();

    const notification = {
      type: 'certificate_rejected',
      title: 'Chứng chỉ bị từ chối',
      message:
        `Chứng chỉ "${cert.title}" của bạn đã bị từ chối.` +
        (adminNote ? ` Lý do: ${adminNote}` : '')
    };
    await this.sendNotification(cert.tutorId.toString(), notification);

    // 🔔 Realtime
    this.socketService.emitToUser(cert.tutorId.toString(), 'certificate:rejected', {
      certId:    cert._id.toString(),
      certTitle: cert.title,
      adminNote: cert.adminNote,
      ...notification
    });

    return cert.toObject();
  }

  // ═══════════════════════════════════════════════════════════
  //  ADMIN: yêu cầu gia sư cập nhật minh chứng
  // ═══════════════════════════════════════════════════════════
  async requestCertificateUpdate(certId: string, adminNote?: string): Promise<object> {
    const cert = await this.findCertOrFail(certId);

    cert.status = 'pending';
    cert.adminNote = adminNote?.trim() ?? 'Admin yêu cầu cập nhật minh chứng';
    await cert.save();

    const notification = {
      type: 'certificate_update_requested',
      title: 'Yêu cầu cập nhật minh chứng',
      message:
        `Admin yêu cầu bạn cập nhật minh chứng cho chứng chỉ "${cert.title}".` +
        (adminNote ? ` Ghi chú: ${adminNote}` : '')
    };
    await this.sendNotification(cert.tutorId.toString(), notification);

    // 🔔 Realtime
    this.socketService.emitToUser(cert.tutorId.toString(), 'certificate:update_requested', {
      certId:    cert._id.toString(),
      certTitle: cert.title,
      adminNote: cert.adminNote,
      ...notification
    });

    return cert.toObject();
  }

  // ═══════════════════════════════════════════════════════════
  //  ADMIN: thu hồi xác minh chứng chỉ
  // ═══════════════════════════════════════════════════════════
  async revokeCertificate(certId: string, adminNote?: string): Promise<object> {
    const cert = await this.findCertOrFail(certId);

    cert.status = 'revoked';
    cert.adminNote = adminNote?.trim() ?? '';
    await cert.save();

    const notification = {
      type: 'certificate_revoked',
      title: 'Chứng chỉ bị thu hồi xác minh',
      message:
        `Chứng chỉ "${cert.title}" đã bị thu hồi trạng thái xác minh.` +
        (adminNote ? ` Lý do: ${adminNote}` : '') +
        ' Chứng chỉ sẽ không hiển thị trên hồ sơ gia sư cho đến khi được duyệt lại.'
    };
    await this.sendNotification(cert.tutorId.toString(), notification);

    // 🔔 Realtime
    this.socketService.emitToUser(cert.tutorId.toString(), 'certificate:revoked', {
      certId:    cert._id.toString(),
      certTitle: cert.title,
      adminNote: cert.adminNote,
      ...notification
    });

    return cert.toObject();
  }

  // ═══════════════════════════════════════════════════════════
  //  ADMIN: lấy download URL của file chứng chỉ
  // ═══════════════════════════════════════════════════════════
  async getCertificateDownloadUrl(certId: string) {
    const cert = await this.certModel.findById(certId).lean();
    if (!cert) throw new NotFoundException('Certificate not found');
    const url = await this.storageService.createDownloadUrl(
      cert.fileKey, cert.originalFileName, 'inline', 300
    );
    return { url, expiresIn: 300 };
  }

  // ═══════════════════════════════════════════════════════════
  //  TUTOR: lấy download URL của chứng chỉ cá nhân
  // ═══════════════════════════════════════════════════════════
  async getOwnCertificateDownloadUrl(userId: string, certId: string) {
    const cert = await this.certModel.findOne({ _id: certId, tutorId: userId }).lean();
    if (!cert) throw new NotFoundException('Certificate not found');
    const url = await this.storageService.createDownloadUrl(
      cert.fileKey, cert.originalFileName, 'inline', 300
    );
    return { url, expiresIn: 300 };
  }

  // ═══════════════════════════════════════════════════════════
  //  SCHEDULED: kiểm tra chứng chỉ sắp hết hạn (30 ngày)
  //  Chạy lúc 01:00 mỗi ngày
  // ═══════════════════════════════════════════════════════════
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async checkExpiringCertificates() {
    this.logger.log('Checking certificates expiring within 30 days...');
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const thirtyDaysLaterStr = thirtyDaysLater.toISOString().slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);

    const expiringCerts = await this.certModel.find({
      status: 'approved',
      isPermanent: false,
      expiryDate: { $gt: todayStr, $lte: thirtyDaysLaterStr },
      $or: [
        { expiryNotifiedAt: null },
        { expiryNotifiedAt: { $lt: new Date(todayStr) } }
      ]
    });

    for (const cert of expiringCerts) {
      const daysLeft = Math.ceil(
        (new Date(cert.expiryDate!).getTime() - Date.now()) / 86_400_000
      );
      const notification = {
        type: 'certificate_expiring_soon',
        title: 'Chứng chỉ sắp hết hạn',
        message:
          `Chứng chỉ "${cert.title}" sẽ hết hạn sau ${daysLeft} ngày ` +
          `(${cert.expiryDate}). Vui lòng gia hạn hoặc cập nhật kịp thời.`
      };
      await this.sendNotification(cert.tutorId.toString(), notification);
      this.socketService.emitToUser(cert.tutorId.toString(), 'notification:new', notification);

      cert.expiryNotifiedAt = new Date();
      await cert.save();
    }
    this.logger.log(`Notified ${expiringCerts.length} expiring certificate(s).`);
  }

  // ═══════════════════════════════════════════════════════════
  //  SCHEDULED: tự động hết hạn chứng chỉ — 02:00 mỗi ngày
  // ═══════════════════════════════════════════════════════════
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async expireCertificates() {
    this.logger.log('Expiring overdue certificates...');
    const todayStr = new Date().toISOString().slice(0, 10);

    const overdueCerts = await this.certModel.find({
      status: 'approved',
      isPermanent: false,
      expiryDate: { $lt: todayStr }
    });

    for (const cert of overdueCerts) {
      cert.status = 'expired';
      await cert.save();

      const notification = {
        type: 'certificate_expired',
        title: 'Chứng chỉ đã hết hiệu lực',
        message:
          `Chứng chỉ "${cert.title}" đã hết hiệu lực kể từ ${cert.expiryDate}. ` +
          `Chứng chỉ không còn hiển thị trên hồ sơ gia sư.`
      };
      await this.sendNotification(cert.tutorId.toString(), notification);
      this.socketService.emitToUser(cert.tutorId.toString(), 'notification:new', notification);
    }
    this.logger.log(`Expired ${overdueCerts.length} certificate(s).`);
  }

  // ═══════════════════════════════════════════════════════════
  //  SCHEDULED: kiểm tra cert vĩnh viễn chưa xác nhận ≥ 3 năm
  //  Chạy 03:00 Chủ nhật hàng tuần
  // ═══════════════════════════════════════════════════════════
  @Cron('0 3 * * 0')
  async checkPermanentCertificateConfirmation() {
    this.logger.log('Checking permanent certificates needing re-confirmation...');
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    const staleCerts = await this.certModel.find({
      status: 'approved',
      isPermanent: true,
      $or: [
        { lastConfirmedAt: null },
        { lastConfirmedAt: { $lt: threeYearsAgo } }
      ]
    });

    for (const cert of staleCerts) {
      cert.status = 'needs_update';
      cert.adminNote = 'Cần xác nhận lại tính chính xác của chứng chỉ (định kỳ 3 năm)';
      await cert.save();

      const notification = {
        type: 'certificate_needs_confirmation',
        title: 'Xác nhận tính chính xác chứng chỉ',
        message:
          `Chứng chỉ "${cert.title}" cần được xác nhận lại tính chính xác ` +
          `(định kỳ 3 năm). Vui lòng đăng nhập và xác nhận.`
      };
      await this.sendNotification(cert.tutorId.toString(), notification);
      this.socketService.emitToUser(cert.tutorId.toString(), 'notification:new', notification);
    }
    this.logger.log(`Marked ${staleCerts.length} permanent certificate(s) as needs_update.`);
  }

  // ─── helpers ──────────────────────────────────────────────

  private validateCertificateDto(dto: ApplyCertificateDto) {
    if (!dto.isPermanent && !dto.expiryDate) {
      throw new BadRequestException('expiryDate is required for non-permanent certificates');
    }
    if (dto.isPermanent && dto.expiryDate) {
      throw new BadRequestException('Permanent certificates must not have an expiryDate');
    }
    if (!dto.isPermanent && dto.expiryDate && dto.expiryDate <= dto.issueDate) {
      throw new BadRequestException('expiryDate must be after issueDate');
    }
  }

  private assertFileOwnership(fileKey: string, userId: string) {
    if (!this.storageService.isTutorEvidenceOwnedBy(fileKey, userId)) {
      throw new BadRequestException('Certificate file does not belong to the current user');
    }
  }

  private buildCertFields(dto: ApplyCertificateDto) {
    return {
      title: dto.title.trim(),
      issuer: dto.issuer.trim(),
      issueDate: dto.issueDate,
      expiryDate: dto.isPermanent ? null : (dto.expiryDate ?? null),
      isPermanent: dto.isPermanent,
      description: dto.description?.trim() ?? '',
      fileKey: dto.fileKey,
      originalFileName: dto.originalFileName,
      fileType: dto.fileType,
      fileSize: dto.fileSize
    };
  }

  private buildHistoryEntry(dto: ApplyCertificateDto, revision: number) {
    return { ...this.buildCertFields(dto), revision, submittedAt: new Date() };
  }

  private async findCertOrFail(certId: string): Promise<CertificateDocument> {
    const cert = await this.certModel.findById(certId);
    if (!cert) throw new NotFoundException('Certificate not found');
    return cert;
  }

  /** Lưu thông báo vào DB (persistent). Socket là delivery realtime riêng. */
  private async sendNotification(
    userId: string,
    payload: { type: string; title: string; message: string }
  ) {
    try {
      await this.notificationModel.create({
        userId: new Types.ObjectId(userId),
        ...payload,
        isRead: false
      });
    } catch (error) {
      this.logger.warn(
        `Failed to save notification for user ${userId}: ${(error as Error).message}`
      );
    }
  }
}
