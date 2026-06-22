import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateMatchRequestDto } from './dto/create-match-request.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { MatchRequest, MatchRequestDocument } from './schemas/match-request.schema';
import { PostDocument, PostEntity } from './schemas/post.schema';

@Injectable()
export class PostService {
  constructor(
    @InjectModel(PostEntity.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(MatchRequest.name) private readonly matchRequestModel: Model<MatchRequestDocument>
  ) {}

  async createPost(dto: CreatePostDto) {
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

  async getPostById(postId: string) {
    const post = await this.postModel.findById(postId).lean();
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  async createMatchRequest(dto: CreateMatchRequestDto) {
    const post = await this.postModel.findById(dto.postId).lean();
    if (!post) {
      throw new NotFoundException('Cannot create match request: post not found');
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

  async getMatchRequestsByPost(postId: string) {
    return this.matchRequestModel.find({ postId }).lean();
  }
}

