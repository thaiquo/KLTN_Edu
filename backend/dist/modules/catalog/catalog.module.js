"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const catalog_controller_1 = require("./catalog.controller");
const catalog_service_1 = require("./catalog.service");
const level_schema_1 = require("./schemas/level.schema");
const role_schema_1 = require("./schemas/role.schema");
const subject_schema_1 = require("./schemas/subject.schema");
let CatalogModule = class CatalogModule {
};
exports.CatalogModule = CatalogModule;
exports.CatalogModule = CatalogModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: role_schema_1.Role.name, schema: role_schema_1.RoleSchema },
                { name: subject_schema_1.Subject.name, schema: subject_schema_1.SubjectSchema },
                { name: level_schema_1.Level.name, schema: level_schema_1.LevelSchema }
            ])
        ],
        controllers: [catalog_controller_1.CatalogController],
        providers: [catalog_service_1.CatalogService],
        exports: [catalog_service_1.CatalogService]
    })
], CatalogModule);
//# sourceMappingURL=catalog.module.js.map