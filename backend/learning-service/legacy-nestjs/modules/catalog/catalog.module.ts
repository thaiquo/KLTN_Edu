import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { Level, LevelSchema } from './schemas/level.schema';
import { Role, RoleSchema } from './schemas/role.schema';
import { Subject, SubjectSchema } from './schemas/subject.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Role.name, schema: RoleSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: Level.name, schema: LevelSchema }
    ])
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService]
})
export class CatalogModule {}
