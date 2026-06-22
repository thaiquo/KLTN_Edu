import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { SessionService } from './session.service';

@Controller()
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post('sessions')
  createSession(@Body() dto: CreateSessionDto) {
    return this.sessionService.createSession(dto);
  }

  @Get('sessions')
  getAllSessions() {
    return this.sessionService.getAllSessions();
  }

  @Get('sessions/:sessionId')
  getSessionById(@Param('sessionId') sessionId: string) {
    return this.sessionService.getSessionById(sessionId);
  }

  @Patch('sessions/:sessionId/complete')
  markSessionCompleted(@Param('sessionId') sessionId: string) {
    return this.sessionService.markSessionCompleted(sessionId);
  }

  @Post('attendances')
  createAttendance(@Body() dto: CreateAttendanceDto) {
    return this.sessionService.createAttendance(dto);
  }

  @Get('sessions/:sessionId/attendances')
  getAttendancesBySession(@Param('sessionId') sessionId: string) {
    return this.sessionService.getAttendancesBySession(sessionId);
  }
}
