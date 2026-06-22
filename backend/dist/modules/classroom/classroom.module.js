"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassroomModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const tutor_profile_schema_1 = require("../user/schemas/tutor-profile.schema");
const classroom_controller_1 = require("./classroom.controller");
const classroom_service_1 = require("./classroom.service");
const classroom_schema_1 = require("./schemas/classroom.schema");
const enrollment_schema_1 = require("./schemas/enrollment.schema");
let ClassroomModule = class ClassroomModule {
};
exports.ClassroomModule = ClassroomModule;
exports.ClassroomModule = ClassroomModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: classroom_schema_1.ClassRoom.name, schema: classroom_schema_1.ClassRoomSchema },
                { name: enrollment_schema_1.Enrollment.name, schema: enrollment_schema_1.EnrollmentSchema },
                { name: tutor_profile_schema_1.TutorProfile.name, schema: tutor_profile_schema_1.TutorProfileSchema }
            ])
        ],
        controllers: [classroom_controller_1.ClassroomController],
        providers: [classroom_service_1.ClassroomService],
        exports: [classroom_service_1.ClassroomService]
    })
], ClassroomModule);
//# sourceMappingURL=classroom.module.js.map