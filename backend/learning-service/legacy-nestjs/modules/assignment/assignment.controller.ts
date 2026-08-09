import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { AssignmentService } from './assignment.service';

@Controller()
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Post('assignments')
  createAssignment(@Body() dto: CreateAssignmentDto) {
    return this.assignmentService.createAssignment(dto);
  }

  @Get('assignments')
  getAllAssignments() {
    return this.assignmentService.getAllAssignments();
  }

  @Get('assignments/:assignmentId')
  getAssignmentById(@Param('assignmentId') assignmentId: string) {
    return this.assignmentService.getAssignmentById(assignmentId);
  }

  @Post('submissions')
  createSubmission(@Body() dto: CreateSubmissionDto) {
    return this.assignmentService.createSubmission(dto);
  }

  @Get('assignments/:assignmentId/submissions')
  getSubmissionsByAssignment(@Param('assignmentId') assignmentId: string) {
    return this.assignmentService.getSubmissionsByAssignment(assignmentId);
  }
}
