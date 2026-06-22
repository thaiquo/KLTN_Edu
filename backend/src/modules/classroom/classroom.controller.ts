import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { ClassroomService } from './classroom.service';
import { CreateClassRoomDto } from './dto/create-classroom.dto';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

@Controller()
export class ClassroomController {
  constructor(private readonly classroomService: ClassroomService) {}

  @Post('classrooms')
  @UseGuards(JwtAuthGuard)
  createClassRoom(
    @Req() request: Request & { user: JwtPayload },
    @Body() dto: CreateClassRoomDto
  ) {
    if (request.user.sub !== dto.tutorId && request.user.role !== 'admin') {
      throw new ForbiddenException('You can only create classes for your own tutor account');
    }
    return this.classroomService.createClassRoom(dto);
  }

  @Get('classrooms')
  getAllClassRooms() {
    return this.classroomService.getAllClassRooms();
  }

  @Get('classrooms/:classId')
  getClassRoomById(@Param('classId') classId: string) {
    return this.classroomService.getClassRoomById(classId);
  }

  @Post('enrollments')
  createEnrollment(@Body() dto: CreateEnrollmentDto) {
    return this.classroomService.createEnrollment(dto);
  }

  @Get('classrooms/:classId/enrollments')
  getEnrollmentsByClass(@Param('classId') classId: string) {
    return this.classroomService.getEnrollmentsByClass(classId);
  }
}
