"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const contract_schema_1 = require("./schemas/contract.schema");
const payment_schema_1 = require("./schemas/payment.schema");
let PaymentService = class PaymentService {
    constructor(contractModel, paymentModel) {
        this.contractModel = contractModel;
        this.paymentModel = paymentModel;
    }
    async createContract(dto) {
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
    async createPayment(dto) {
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
};
exports.PaymentService = PaymentService;
exports.PaymentService = PaymentService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(contract_schema_1.Contract.name)),
    __param(1, (0, mongoose_1.InjectModel)(payment_schema_1.Payment.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], PaymentService);
//# sourceMappingURL=payment.service.js.map