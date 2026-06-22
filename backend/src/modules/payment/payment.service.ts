import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Contract, ContractDocument } from './schemas/contract.schema';
import { Payment, PaymentDocument } from './schemas/payment.schema';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Contract.name)
    private readonly contractModel: Model<ContractDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>
  ) {}

  async createContract(dto: CreateContractDto) {
    return this.contractModel.create({
      ...dto,
      network: dto.network ?? '',
      status: dto.status ?? 'draft',
      platformFeePercent: dto.platformFeePercent ?? 10,
      balance: dto.balance ?? 0,
      isActive: dto.isActive ?? true
    });
  }

  async listContracts() {
    return this.contractModel.find().sort({ createdAt: -1 }).exec();
  }

  async createPayment(dto: CreatePaymentDto) {
    const hash = dto.transactionHash ?? dto.txHash ?? '';

    return this.paymentModel.create({
      ...dto,
      fromWallet: dto.fromWallet ?? '',
      toWallet: dto.toWallet ?? '',
      status: dto.status ?? 'pending',
      transactionHash: hash,
      txHash: hash
    });
  }

  async listPayments() {
    return this.paymentModel.find().sort({ createdAt: -1 }).exec();
  }
}
