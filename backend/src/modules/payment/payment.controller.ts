import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentService } from './payment.service';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('contracts')
  createContract(@Body() dto: CreateContractDto) {
    return this.paymentService.createContract(dto);
  }

  @Get('contracts')
  listContracts() {
    return this.paymentService.listContracts();
  }

  @Post()
  createPayment(@Body() dto: CreatePaymentDto) {
    return this.paymentService.createPayment(dto);
  }

  @Get()
  listPayments() {
    return this.paymentService.listPayments();
  }
}
