import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { WalletService } from './wallet.service';

@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post()
  createWallet(@Body() dto: CreateWalletDto) {
    return this.walletService.createWallet(dto);
  }

  @Get()
  listWallets() {
    return this.walletService.listWallets();
  }

  @Get('users/:userId')
  getWalletByUser(@Param('userId') userId: string) {
    return this.walletService.getWalletByUser(userId);
  }
}
