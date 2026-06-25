import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsMimeType,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min
} from 'class-validator';

// ── Tutor nộp / cập nhật chứng chỉ ──────────────────────────────────────────
export class ApplyCertificateDto {
  /** Tên chứng chỉ */
  @IsString() @IsNotEmpty()
  title!: string;

  /** Tổ chức cấp */
  @IsString() @IsNotEmpty()
  issuer!: string;

  /** Ngày cấp (YYYY-MM-DD) */
  @IsDateString()
  issueDate!: string;

  /**
   * true  → chứng chỉ vĩnh viễn, expiryDate phải bỏ trống
   * false → chứng chỉ có hạn, expiryDate bắt buộc
   */
  @IsBoolean()
  isPermanent!: boolean;

  /** Ngày hết hạn (YYYY-MM-DD). Bắt buộc khi isPermanent = false */
  @IsOptional() @IsDateString()
  expiryDate?: string | null;

  @IsOptional() @IsString()
  description?: string;

  /** fileKey trả về từ endpoint upload evidence */
  @IsString() @IsNotEmpty()
  fileKey!: string;

  @IsString() @IsNotEmpty()
  originalFileName!: string;

  @IsMimeType()
  fileType!: string;

  @IsInt() @Min(1)
  fileSize!: number;
}

// ── Admin xét duyệt ──────────────────────────────────────────────────────────
export class AdminCertificateActionDto {
  @IsOptional() @IsString()
  adminNote?: string;
}
