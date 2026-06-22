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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchRequestSchema = exports.MatchRequest = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let MatchRequest = class MatchRequest {
};
exports.MatchRequest = MatchRequest;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'PostEntity', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], MatchRequest.prototype, "postId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], MatchRequest.prototype, "tutorId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], MatchRequest.prototype, "from", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: false, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], MatchRequest.prototype, "to", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['student_to_tutor', 'tutor_to_student'], default: 'tutor_to_student' }),
    __metadata("design:type", String)
], MatchRequest.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['pending', 'accepted', 'rejected', 'cancelled'], default: 'pending' }),
    __metadata("design:type", String)
], MatchRequest.prototype, "status", void 0);
exports.MatchRequest = MatchRequest = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'match_requests' })
], MatchRequest);
exports.MatchRequestSchema = mongoose_1.SchemaFactory.createForClass(MatchRequest);
//# sourceMappingURL=match-request.schema.js.map