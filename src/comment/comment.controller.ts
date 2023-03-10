import { Express } from 'express'

import {
  Controller,
  Post,
  Get,
  UseGuards,
  UseInterceptors,
  Body,
  Request,
  Param,
  UploadedFiles,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common'

import { FilesInterceptor } from '@nestjs/platform-express'

import { Payload } from 'src/auth/interfaces/Payload'
import { Comment } from './entities/comment.entity'

import { CommentService } from './comment.service'

import { JwtAuthGuard } from 'src/auth/jwt-auth.strategy'

import { createCommentDto } from './dto/createComment.dto'
import { likeCommentDto } from './dto/likeCommentDto.dto'

@Controller('api/comments')
export class CommentController {
  constructor(private commentService: CommentService) {}

  @Get(':commentId')
  async getCommentById(
    @Param('commentId', new ParseUUIDPipe()) commentId: string
  ): Promise<{ comment: Comment }> {
    return await this.commentService.findCommentById(commentId)
  }

  @Get('post/:postId')
  async tweetComments(
    @Param('postId', new ParseUUIDPipe()) postId: string
  ): Promise<{ comments: Comment[] }> {
    return await this.commentService.findCommentsByPostId(postId)
  }

  @Get('comment/:commentId')
  async commentComments(
    @Param('commentId', new ParseUUIDPipe()) commentId: string
  ): Promise<{ comments: Comment[] }> {
    return await this.commentService.findCommentsByCommentId(commentId)
  }

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images'))
  @Post()
  async createComment(
    @Body() commentData: createCommentDto,
    @Request() req: { user: Payload },
    @UploadedFiles() images: Array<Express.Multer.File>
  ): Promise<{ comment: Comment }> {
    return await this.commentService.createComment(
      commentData,
      req.user.userId,
      images
    )
  }

  @UseGuards(JwtAuthGuard)
  @Post('like')
  async likeComment(
    @Body() comment: likeCommentDto,
    @Request() req: { user: Payload }
  ): Promise<{ comment: Comment }> {
    return await this.commentService.likeComment(
      req.user.userId,
      comment.commentId
    )
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':commentId')
  async deleteComment(
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
    @Request() req: { user: Payload }
  ): Promise<{ message: string }> {
    return await this.commentService.deleteComment(commentId, req.user.userId)
  }
}
