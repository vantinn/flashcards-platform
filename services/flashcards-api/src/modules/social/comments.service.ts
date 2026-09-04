import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Comment } from './entities/comment.entity.js';
import { FlashcardSetsService } from '../flashcard-sets/flashcard-sets.service.js';
import type { CreateCommentDto } from './dto/create-comment.dto.js';
import type { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import type { PaginatedResult } from '../../common/dto/pagination.dto.js';

export interface CommentView {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; displayName: string; avatarUrl: string | null };
  replyCount: number;
  canEdit: boolean;
  canDelete: boolean;
}

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    private readonly flashcardSetsService: FlashcardSetsService,
  ) {}

  async create(setId: string, userId: string, dto: CreateCommentDto): Promise<CommentView> {
    const set = await this.flashcardSetsService.assertPublicForSocial(setId, userId);

    const comment = this.commentsRepository.create({
      flashcardSet: { id: setId },
      user: { id: userId },
      parentComment: null,
      content: dto.content,
    });
    const saved = await this.commentsRepository.save(comment);
    return this.toView(await this.findOrFail(saved.id), set.creator.id, userId, 0);
  }

  /**
   * Cross-set injection guard: the parent comment must actually belong to
   * the set the caller says they're replying within — a client can't
   * attach a reply to setId A while parentCommentId points at a comment
   * that lives on setId B. Also enforces the V1 one-level-of-nesting rule:
   * the parent itself must be top-level (parentComment === null), so a
   * reply can never be replied to.
   */
  async reply(setId: string, parentCommentId: string, userId: string, dto: CreateCommentDto): Promise<CommentView> {
    const set = await this.flashcardSetsService.assertPublicForSocial(setId, userId);

    const parent = await this.commentsRepository.findOne({
      where: { id: parentCommentId },
      relations: { flashcardSet: true, parentComment: true },
    });
    if (!parent) {
      throw new NotFoundException('Comment not found');
    }
    if (parent.flashcardSet.id !== setId) {
      throw new BadRequestException('This comment does not belong to the requested flashcard set');
    }
    if (parent.parentComment !== null) {
      throw new BadRequestException('Replies can only be made to a top-level comment');
    }

    const reply = this.commentsRepository.create({
      flashcardSet: { id: setId },
      user: { id: userId },
      parentComment: { id: parentCommentId },
      content: dto.content,
    });
    const saved = await this.commentsRepository.save(reply);
    return this.toView(await this.findOrFail(saved.id), set.creator.id, userId, 0);
  }

  /** Author-only — editing a comment is not a moderation action, unlike delete. */
  async update(commentId: string, userId: string, dto: CreateCommentDto): Promise<CommentView> {
    const comment = await this.findOrFail(commentId);
    if (comment.user.id !== userId) {
      throw new ForbiddenException('You can only edit your own comment');
    }
    comment.content = dto.content;
    const saved = await this.commentsRepository.save(comment);
    const replyCount = (await this.replyCountsFor([commentId])).get(commentId) ?? 0;
    return this.toView(saved, comment.flashcardSet.creator.id, userId, replyCount);
  }

  /**
   * The author can delete their own comment; the owner of the set it lives
   * on can also delete it for moderation — see FlashcardSetsService's
   * ownership checks for the same "moderation vs. authorship" split. Unlike
   * findOneVisibleTo/assertOwnership, no 404-before-403 games are needed
   * here: both an author and a set owner who reach this point can already
   * see the comment/set, so a plain 403 doesn't confirm anything new to an
   * unrelated caller who was already rejected by assertPublicForSocial
   * upstream on any endpoint that lists comments.
   */
  async remove(commentId: string, userId: string): Promise<void> {
    const comment = await this.findOrFail(commentId);
    const isAuthor = comment.user.id === userId;
    const isSetOwner = comment.flashcardSet.creator.id === userId;
    if (!isAuthor && !isSetOwner) {
      throw new ForbiddenException('You do not have permission to delete this comment');
    }
    await this.commentsRepository.remove(comment);
  }

  private async findOrFail(commentId: string): Promise<Comment> {
    const comment = await this.commentsRepository.findOne({
      where: { id: commentId },
      relations: { user: true, flashcardSet: { creator: true } },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  async findTopLevelForSet(
    setId: string,
    currentUserId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<CommentView>> {
    const set = await this.flashcardSetsService.assertPublicForSocial(setId, currentUserId);
    const { page, limit } = query;

    const [items, total] = await this.commentsRepository.findAndCount({
      where: { flashcardSet: { id: setId }, parentComment: IsNull() },
      relations: { user: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const replyCounts = await this.replyCountsFor(items.map((comment) => comment.id));

    return {
      items: items.map((comment) => this.toView(comment, set.creator.id, currentUserId, replyCounts.get(comment.id) ?? 0)),
      total,
      page,
      limit,
    };
  }

  /** V1 keeps this unpaginated — a single top-level comment is expected to have few replies. */
  async findRepliesForComment(setId: string, parentCommentId: string, currentUserId: string): Promise<CommentView[]> {
    const set = await this.flashcardSetsService.assertPublicForSocial(setId, currentUserId);

    const replies = await this.commentsRepository.find({
      where: { flashcardSet: { id: setId }, parentComment: { id: parentCommentId } },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });

    return replies.map((reply) => this.toView(reply, set.creator.id, currentUserId, 0));
  }

  /**
   * Batched — one grouped query for a whole page of sets, not one per set.
   * Counts every comment on the set (top-level and replies together), which
   * is the "N comments" figure Explore/set-detail display.
   */
  async countForSets(setIds: string[]): Promise<Map<string, number>> {
    if (setIds.length === 0) return new Map();

    const rows = await this.commentsRepository
      .createQueryBuilder('comment')
      .select('comment.flashcard_set_id', 'setId')
      .addSelect('COUNT(*)', 'count')
      .where('comment.flashcard_set_id IN (:...setIds)', { setIds })
      .groupBy('comment.flashcard_set_id')
      .getRawMany<{ setId: string; count: string }>();

    return new Map(rows.map((row) => [row.setId, Number(row.count)]));
  }

  private async replyCountsFor(parentIds: string[]): Promise<Map<string, number>> {
    if (parentIds.length === 0) return new Map();

    const rows = await this.commentsRepository
      .createQueryBuilder('comment')
      .select('comment.parent_comment_id', 'parentId')
      .addSelect('COUNT(*)', 'count')
      .where('comment.parent_comment_id IN (:...parentIds)', { parentIds })
      .groupBy('comment.parent_comment_id')
      .getRawMany<{ parentId: string; count: string }>();

    return new Map(rows.map((row) => [row.parentId, Number(row.count)]));
  }

  private toView(comment: Comment, setOwnerId: string, currentUserId: string, replyCount: number): CommentView {
    const isAuthor = comment.user.id === currentUserId;
    return {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: { id: comment.user.id, displayName: comment.user.displayName, avatarUrl: comment.user.avatarUrl },
      replyCount,
      canEdit: isAuthor,
      canDelete: isAuthor || setOwnerId === currentUserId,
    };
  }
}
