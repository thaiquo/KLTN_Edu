import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateMatchRequestDto } from './dto/create-match-request.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { PostService } from './post.service';

@Controller()
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post('posts')
  createPost(@Body() dto: CreatePostDto) {
    return this.postService.createPost(dto);
  }

  @Get('posts')
  getAllPosts() {
    return this.postService.getAllPosts();
  }

  @Get('posts/:postId')
  getPostById(@Param('postId') postId: string) {
    return this.postService.getPostById(postId);
  }

  @Post('match-requests')
  createMatchRequest(@Body() dto: CreateMatchRequestDto) {
    return this.postService.createMatchRequest(dto);
  }

  @Get('posts/:postId/match-requests')
  getMatchRequestsByPost(@Param('postId') postId: string) {
    return this.postService.getMatchRequestsByPost(postId);
  }
}
