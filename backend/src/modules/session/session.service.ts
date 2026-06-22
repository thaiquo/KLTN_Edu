import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { Attendance, AttendanceDocument } from './schemas/attendance.schema';
import { Session, SessionDocument } from './schemas/session.schema';

@Injectable()
export class SessionService {
  constructor(
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>
  ) {}

  async createSession(dto: CreateSessionDto) {
    const created = new this.sessionModel({
      classId: dto.classId,
      date: dto.date,
      startTime: dto.startTime ?? '',
      endTime: dto.endTime ?? '',
      link: dto.link ?? '',
      status: dto.status ?? 'scheduled'
    });
    return created.save();
  }

  async getAllSessions() {
    return this.sessionModel.find().lean();
  }

  async getSessionById(sessionId: string) {
    const session = await this.sessionModel.findById(sessionId).lean();
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  async markSessionCompleted(sessionId: string) {
    const updated = await this.sessionModel
      .findByIdAndUpdate(sessionId, { status: 'completed' }, { new: true })
      .lean();
    if (!updated) {
      throw new NotFoundException('Session not found');
    }
    return updated;
  }

  async createAttendance(dto: CreateAttendanceDto) {
    const session = await this.sessionModel.findById(dto.sessionId).lean();
    if (!session) {
      throw new NotFoundException('Cannot create attendance: session not found');
    }

    const created = new this.attendanceModel({
      sessionId: dto.sessionId,
      userId: dto.userId,
      present: dto.present,
      checkinDate: dto.checkinDate ?? new Date().toISOString(),
      type: dto.type ?? 'student'
    });
    return created.save();
  }

  async getAttendancesBySession(sessionId: string) {
    return this.attendanceModel.find({ sessionId }).lean();
  }
}
