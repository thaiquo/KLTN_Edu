import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { Wallet, WalletDocument } from './schemas/wallet.schema';

@Injectable()
export class WalletService {
  constructor(@InjectModel(Wallet.name) private readonly walletModel: Model<WalletDocument>) {}

  createWallet(dto: CreateWalletDto) {
    return this.walletModel.create({
      ...dto,
      balance: dto.balance ?? 0
    });
  }

  listWallets() {
    return this.walletModel.find().sort({ createdAt: -1 }).lean();
  }

  getWalletByUser(userId: string) {
    return this.walletModel.findOne({ userId }).lean();
  }
}
