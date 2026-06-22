import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateLevelDto } from './dto/create-level.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { Level, LevelDocument } from './schemas/level.schema';
import { Role, RoleDocument } from './schemas/role.schema';
import { Subject, SubjectDocument } from './schemas/subject.schema';

@Injectable()
export class CatalogService {
  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(Subject.name) private readonly subjectModel: Model<SubjectDocument>,
    @InjectModel(Level.name) private readonly levelModel: Model<LevelDocument>
  ) {}

  createRole(dto: CreateRoleDto) {
    return this.roleModel.create(dto);
  }

  listRoles() {
    return this.roleModel.find().sort({ name: 1 }).lean();
  }

  createSubject(dto: CreateSubjectDto) {
    return this.subjectModel.create({
      name: dto.name,
      description: dto.description ?? ''
    });
  }

  listSubjects() {
    return this.subjectModel.find().sort({ name: 1 }).lean();
  }

  createLevel(dto: CreateLevelDto) {
    return this.levelModel.create(dto);
  }

  listLevels() {
    return this.levelModel.find().sort({ name: 1 }).lean();
  }
}
