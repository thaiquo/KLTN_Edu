import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { Assignment, AssignmentDocument } from './schemas/assignment.schema';
import { Submission, SubmissionDocument } from './schemas/submission.schema';

@Injectable()
export class AssignmentService {
  constructor(
    @InjectModel(Assignment.name) private readonly assignmentModel: Model<AssignmentDocument>,
    @InjectModel(Submission.name) private readonly submissionModel: Model<SubmissionDocument>
  ) {}

  async createAssignment(dto: CreateAssignmentDto) {
    const created = new this.assignmentModel({
      classId: dto.classId,
      title: dto.title,
      description: dto.description ?? '',
      fileUrl: dto.fileUrl ?? [],
      dueDate: dto.dueDate ?? '',
      content: dto.content ?? ''
    });
    return created.save();
  }

  async getAllAssignments() {
    return this.assignmentModel.find().lean();
  }

  async getAssignmentById(assignmentId: string) {
    const assignment = await this.assignmentModel.findById(assignmentId).lean();
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    return assignment;
  }

  async createSubmission(dto: CreateSubmissionDto) {
    const assignment = await this.assignmentModel.findById(dto.assignmentId).lean();
    if (!assignment) {
      throw new NotFoundException('Cannot create submission: assignment not found');
    }

    const created = new this.submissionModel({
      assignmentId: dto.assignmentId,
      studentId: dto.studentId,
      content: dto.content ?? '',
      fileUrl: dto.fileUrl ?? [],
      score: dto.score ?? 0,
      feedback: dto.feedback ?? ''
    });

    return created.save();
  }

  async getSubmissionsByAssignment(assignmentId: string) {
    return this.submissionModel.find({ assignmentId }).lean();
  }
}
