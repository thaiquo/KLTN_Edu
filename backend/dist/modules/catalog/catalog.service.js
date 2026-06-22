"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const level_schema_1 = require("./schemas/level.schema");
const role_schema_1 = require("./schemas/role.schema");
const subject_schema_1 = require("./schemas/subject.schema");
let CatalogService = class CatalogService {
    constructor(roleModel, subjectModel, levelModel) {
        this.roleModel = roleModel;
        this.subjectModel = subjectModel;
        this.levelModel = levelModel;
    }
    createRole(dto) {
        return this.roleModel.create(dto);
    }
    listRoles() {
        return this.roleModel.find().sort({ name: 1 }).lean();
    }
    createSubject(dto) {
        return this.subjectModel.create({
            name: dto.name,
            description: dto.description ?? ''
        });
    }
    listSubjects() {
        return this.subjectModel.find().sort({ name: 1 }).lean();
    }
    createLevel(dto) {
        return this.levelModel.create(dto);
    }
    listLevels() {
        return this.levelModel.find().sort({ name: 1 }).lean();
    }
};
exports.CatalogService = CatalogService;
exports.CatalogService = CatalogService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(role_schema_1.Role.name)),
    __param(1, (0, mongoose_1.InjectModel)(subject_schema_1.Subject.name)),
    __param(2, (0, mongoose_1.InjectModel)(level_schema_1.Level.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], CatalogService);
//# sourceMappingURL=catalog.service.js.map