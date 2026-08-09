import { Body, Controller, Get, Post } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CreateLevelDto } from './dto/create-level.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post('roles')
  createRole(@Body() dto: CreateRoleDto) {
    return this.catalogService.createRole(dto);
  }

  @Get('roles')
  listRoles() {
    return this.catalogService.listRoles();
  }

  @Post('subjects')
  createSubject(@Body() dto: CreateSubjectDto) {
    return this.catalogService.createSubject(dto);
  }

  @Get('subjects')
  listSubjects() {
    return this.catalogService.listSubjects();
  }

  @Post('levels')
  createLevel(@Body() dto: CreateLevelDto) {
    return this.catalogService.createLevel(dto);
  }

  @Get('levels')
  listLevels() {
    return this.catalogService.listLevels();
  }
}
