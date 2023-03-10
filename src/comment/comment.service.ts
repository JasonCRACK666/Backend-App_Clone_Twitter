import { Express } from 'express'

import { HttpException, HttpStatus, Injectable } from '@nestjs/common'

import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsRelations, FindOptionsSelect, Repository } from 'typeorm'

import { Comment } from './entities/comment.entity'
import { ImageComment } from './entities/imageComment.entity'

import { UsersService } from 'src/users/users.service'
import { PostService } from 'src/post/post.service'

import cloudinary from 'src/utils/cloudinary'

import { createCommentDto } from './dto/createComment.dto'

@Injectable()
export class CommentService {
  private readonly commentSelectOptionsBase: FindOptionsSelect<Comment> = {
    id: true,
    content: true,
    images: {
      id: true,
      imageUrl: true,
    },
    likes: {
      id: true,
    },
    comments: {
      id: true,
    },
    user: {
      id: true,
      firstName: true,
      username: true,
      account: {
        id: true,
        avatar: true,
        verify: true,
      },
    },
    createdAt: true,
  }

  private readonly commentRelationsOptionsBase: FindOptionsRelations<Comment> =
    {
      images: true,
      likes: true,
      comments: true,
      user: {
        account: true,
      },
    }

  constructor(
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(ImageComment)
    private imageCommentRepository: Repository<ImageComment>,
    private postService: PostService,
    private usersService: UsersService
  ) { }

  async findCommentById(commentId: string): Promise<{ comment: Comment }> {
    const comment = await this.commentRepository.findOne({
      where: {
        id: commentId,
      },
      select: {
        ...this.commentSelectOptionsBase,
        comment: {
          id: true,
          user: {
            username: true,
          },
        },
        post: {
          id: true,
          user: {
            username: true,
          },
        },
      },
      relations: {
        ...this.commentRelationsOptionsBase,
        comment: {
          user: true,
        },
        post: {
          user: true,
        },
      },
    })

    return {
      comment,
    }
  }

  async findCommentsByPostId(postId: string): Promise<{ comments: Comment[] }> {
    const post = await this.postService.findOneById(postId)
    if (!post)
      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          error: 'Tweet does not exist',
        },
        HttpStatus.NOT_FOUND
      )

    const comments = await this.commentRepository.find({
      where: {
        post: {
          id: post.id,
        },
      },
      select: {
        ...this.commentSelectOptionsBase,
        post: {
          id: true,
          user: {
            username: true,
          },
        },
      },
      relations: {
        ...this.commentRelationsOptionsBase,
        post: {
          user: true,
        },
      },
    })

    return {
      comments,
    }
  }

  async findCommentsByCommentId(
    commentId: string
  ): Promise<{ comments: Comment[] }> {
    const comment = await this.commentRepository.findOneBy({ id: commentId })
    if (!comment)
      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          error: 'Comment does not exist',
        },
        HttpStatus.NOT_FOUND
      )

    const comments = await this.commentRepository.find({
      where: {
        comment: {
          id: comment.id,
        },
      },
      select: {
        ...this.commentSelectOptionsBase,
        comment: {
          id: true,
          post: {
            id: true
          },
          comment: {
            id: true
          },
          user: {
            username: true,
          },
        },
      },
      relations: {
        ...this.commentRelationsOptionsBase,
        comment: {
          user: true,
          post: true,
          comment: true
        },
      },
    })

    return {
      comments,
    }
  }

  async createComment(
    commentData: createCommentDto,
    userId: string,
    images: Array<Express.Multer.File>
  ): Promise<{ comment: Comment }> {
    const user = await this.usersService.findOneById(userId)

    if (!user)
      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          error: 'El usuario no existe',
        },
        HttpStatus.NOT_FOUND
      )

    const newComment = new Comment()

    if (commentData.postId) {
      const post = await this.postService.findOneById(commentData.postId)
      if (!post)
        throw new HttpException(
          {
            status: HttpStatus.NOT_FOUND,
            error: 'Tweet does not exist',
          },
          HttpStatus.NOT_FOUND
        )

      newComment.post = post
    } else {
      const comment = await this.commentRepository.findOneBy({
        id: commentData.commentId,
      })
      if (!comment)
        throw new HttpException(
          {
            status: HttpStatus.NOT_FOUND,
            error: 'Comment does not exist',
          },
          HttpStatus.NOT_FOUND
        )

      newComment.comment = comment
    }

    newComment.user = user
    newComment.content = commentData.content

    images.forEach(image => {
      cloudinary.uploader
        .upload(image.path, {
          folder: 'API_TWITTER/images',
        })
        .then(result => {
          const imageComment = new ImageComment()
          imageComment.imageUrl = result.url
          imageComment.comment = newComment

          this.imageCommentRepository.save(imageComment).then()
        })
    })

    const saveComment = await this.commentRepository.save(newComment)

    return {
      comment: saveComment,
    }
  }

  async deleteComment(
    commentId: string,
    userId: string
  ): Promise<{ message: string }> {
    const user = await this.usersService.findOneById(userId)
    if (!user)
      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          error: 'User does not exist',
        },
        HttpStatus.NOT_FOUND
      )

    const comment = await this.commentRepository.findOne({
      where: {
        id: commentId,
      },
      select: {
        id: true,
        user: {
          id: true,
        },
      },
      relations: {
        user: true,
      },
    })

    if (!comment)
      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          error: 'Comment does not exist',
        },
        HttpStatus.NOT_FOUND
      )

    if (comment.user.id !== user.id)
      throw new HttpException(
        {
          status: HttpStatus.UNAUTHORIZED,
          error: 'You are not the owner of the comment',
        },
        HttpStatus.UNAUTHORIZED
      )

    await this.commentRepository.delete({ id: comment.id })

    return {
      message: 'Comment has been deleted',
    }
  }

  async likeComment(
    userId: string,
    commentId: string
  ): Promise<{ comment: Comment }> {
    const user = await this.usersService.findOneById(userId)
    if (!user)
      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          error: 'User does not exist',
        },
        HttpStatus.NOT_FOUND
      )

    const comment = await this.commentRepository.findOne({
      where: {
        id: commentId,
      },
      select: {
        id: true,
        likes: {
          id: true,
        },
      },
      relations: {
        likes: true,
      },
    })

    if (!comment)
      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          error: 'User does not exist',
        },
        HttpStatus.NOT_FOUND
      )

    const matchUserLikedComment = comment.likes.find(
      userLike => userLike.id === user.id
    )

    if (!matchUserLikedComment) {
      comment.likes.push(user)
    } else {
      comment.likes = comment.likes.filter(likeUser => likeUser.id !== user.id)
    }

    const saveComment = await this.commentRepository.save(comment)

    return {
      comment: saveComment,
    }
  }
}
