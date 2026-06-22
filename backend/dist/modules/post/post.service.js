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
exports.PostService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const match_request_schema_1 = require("./schemas/match-request.schema");
const post_schema_1 = require("./schemas/post.schema");
let PostService = class PostService {
    constructor(postModel, matchRequestModel) {
        this.postModel = postModel;
        this.matchRequestModel = matchRequestModel;
    }
    async createPost(dto) {
        const created = new this.postModel({
            studentId: dto.studentId,
            subject: dto.subject,
            level: dto.level,
            description: dto.description,
            budget: dto.budget,
            location: dto.location ?? { lat: 0, lng: 0 }
        });
        return created.save();
    }
    async getAllPosts() {
        return this.postModel.find().lean();
    }
    async getPostById(postId) {
        const post = await this.postModel.findById(postId).lean();
        if (!post) {
            throw new common_1.NotFoundException('Post not found');
        }
        return post;
    }
    async createMatchRequest(dto) {
        const post = await this.postModel.findById(dto.postId).lean();
        if (!post) {
            throw new common_1.NotFoundException('Cannot create match request: post not found');
        }
        const created = new this.matchRequestModel({
            postId: dto.postId,
            tutorId: dto.tutorId,
            from: dto.from ?? dto.tutorId,
            to: dto.to,
            type: dto.type ?? 'tutor_to_student',
            status: dto.status ?? 'pending'
        });
        return created.save();
    }
    async getMatchRequestsByPost(postId) {
        return this.matchRequestModel.find({ postId }).lean();
    }
};
exports.PostService = PostService;
exports.PostService = PostService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(post_schema_1.PostEntity.name)),
    __param(1, (0, mongoose_1.InjectModel)(match_request_schema_1.MatchRequest.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], PostService);
//# sourceMappingURL=post.service.js.map