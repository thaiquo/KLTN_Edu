import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  createConversation(@Body() dto: CreateConversationDto) {
    return this.chatService.createConversation(dto);
  }

  @Get('conversations')
  listConversations() {
    return this.chatService.listConversations();
  }

  @Post('messages')
  createMessage(@Body() dto: CreateMessageDto) {
    return this.chatService.createMessage(dto);
  }

  @Get('conversations/:conversationId/messages')
  listMessages(@Param('conversationId') conversationId: string) {
    return this.chatService.listMessages(conversationId);
  }
}
