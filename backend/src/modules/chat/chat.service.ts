import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { Message, MessageDocument } from './schemas/message.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>
  ) {}

  async createConversation(dto: CreateConversationDto) {
    return this.conversationModel.create({
      ...dto,
      type: dto.type ?? 'direct',
      lastPreview: dto.lastPreview ?? ''
    });
  }

  async listConversations() {
    return this.conversationModel.find().sort({ createdAt: -1 }).exec();
  }

  async createMessage(dto: CreateMessageDto) {
    const message = await this.messageModel.create({
      ...dto,
      type: dto.type ?? 'text',
      attachmentUrls: dto.attachmentUrls ?? [],
      from: dto.from ?? dto.senderId
    });

    await this.conversationModel.updateOne(
      { _id: dto.conversationId },
      { $set: { lastPreview: dto.content } }
    );

    return message;
  }

  async listMessages(conversationId: string) {
    return this.messageModel
      .find({ conversationId })
      .sort({ createdAt: 1 })
      .exec();
  }
}
