import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CertificateStatus =
  | 'pending'      // Chờ admin duyệt
  | 'approved'     // Đã được duyệt
  | 'rejected'     // Bị từ chối
  | 'expired'      // Hết hiệu lực (tự động khi quá ngày expiryDate)
  | 'revoked'      // Bị thu hồi bởi admin
  | 'needs_update'; // Cần xác nhận lại (permanent cert > 3 năm chưa confirm)

export type CertificateDocument = HydratedDocument<Certificate>;

// ── Lịch sử mỗi lần tutor nộp / cập nhật ─────────────────────────────────────
@Schema({ _id: true, timestamps: true })
export class CertificateHistory {
  @Prop({ required: true, trim: true }) title!: string;
  @Prop({ required: true, trim: true }) issuer!: string;
  @Prop({ required: true }) issueDate!: string;
  @Prop({ type: String, default: null }) expiryDate!: string | null;
  @Prop({ default: false }) isPermanent!: boolean;
  @Prop({ default: '', trim: true }) description!: string;
  @Prop({ required: true }) fileKey!: string;
  @Prop({ required: true }) originalFileName!: string;
  @Prop({ required: true }) fileType!: string;
  @Prop({ required: true, min: 1 }) fileSize!: number;
  @Prop({ required: true, min: 1 }) revision!: number;
  @Prop({ type: Date, default: Date.now }) submittedAt!: Date;
}
export const CertificateHistorySchema = SchemaFactory.createForClass(CertificateHistory);

// ── Document chính ─────────────────────────────────────────────────────────────
@Schema({ timestamps: true, collection: 'certificates' })
export class Certificate {
  // Chủ sở hữu
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  tutorId!: Types.ObjectId;

  // ── Dữ liệu hiện tại (luôn phản ánh lần nộp mới nhất) ──
  @Prop({ required: true, trim: true }) title!: string;
  @Prop({ required: true, trim: true }) issuer!: string;
  @Prop({ required: true }) issueDate!: string;

  /**
   * null  → chứng chỉ vĩnh viễn (isPermanent = true)
   * string → ngày hết hạn ISO (YYYY-MM-DD)
   */
  @Prop({ type: String, default: null }) expiryDate!: string | null;

  /**
   * true  → không có ngày hết hạn, tự động vô hiệu hóa
   * false → có expiryDate, hệ thống tự expire
   */
  @Prop({ default: false, index: true }) isPermanent!: boolean;

  @Prop({ default: '', trim: true }) description!: string;
  @Prop({ required: true }) fileKey!: string;
  @Prop({ required: true }) originalFileName!: string;
  @Prop({ required: true }) fileType!: string;
  @Prop({ required: true, min: 1 }) fileSize!: number;

  // ── Trạng thái & admin ──────────────────────────────────
  @Prop({
    type: String,
    required: true,
    enum: ['pending', 'approved', 'rejected', 'expired', 'revoked', 'needs_update'],
    default: 'pending',
    index: true
  })
  status!: CertificateStatus;

  @Prop({ default: '', trim: true }) adminNote!: string;
  @Prop({ required: true, default: 1, min: 1 }) revision!: number;

  // ── Lịch sử các lần nộp ────────────────────────────────
  @Prop({ type: [CertificateHistorySchema], default: [] })
  history!: CertificateHistory[];

  // ── Mốc thời gian đặc biệt ─────────────────────────────
  @Prop({ type: Date, default: Date.now }) submittedAt!: Date;
  @Prop({ type: Date, default: null }) approvedAt!: Date | null;

  /**
   * Dùng cho chứng chỉ vĩnh viễn:
   * mỗi 3 năm tutor phải xác nhận lại → reset trường này
   */
  @Prop({ type: Date, default: null }) lastConfirmedAt!: Date | null;

  /** Đã gửi thông báo sắp hết hạn 30 ngày chưa */
  @Prop({ type: Date, default: null }) expiryNotifiedAt!: Date | null;
}

export const CertificateSchema = SchemaFactory.createForClass(Certificate);
