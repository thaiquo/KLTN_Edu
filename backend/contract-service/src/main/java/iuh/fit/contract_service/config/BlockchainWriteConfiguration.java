package iuh.fit.contract_service.config;

import iuh.fit.contract_service.blockchain.OperatorTransactionGateway;
import iuh.fit.contract_service.blockchain.Web3jOperatorTransactionGateway;
import iuh.fit.contract_service.repository.BlockchainTransactionRepository;
import iuh.fit.contract_service.service.BlockchainReceiptWatcher;
import iuh.fit.contract_service.service.BlockchainTransactionRuntimeWorker;
import iuh.fit.contract_service.service.OperatorTransactionDispatcher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import org.web3j.crypto.Credentials;
import org.web3j.crypto.WalletUtils;
import org.web3j.protocol.Web3j;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(prefix = "blockchain.operator", name = "enabled", havingValue = "true")
public class BlockchainWriteConfiguration {
    private static final Logger log = LoggerFactory.getLogger(BlockchainWriteConfiguration.class);

    @Bean
    Credentials operatorCredentials(OperatorSignerProperties properties) throws Exception {
        Credentials credentials;
        if (properties.getPrivateKey() != null && !properties.getPrivateKey().isBlank()) {
            String pk = properties.getPrivateKey().trim();
            if (pk.startsWith("0x") || pk.startsWith("0X")) {
                pk = pk.substring(2);
            }
            credentials = Credentials.create(pk);
        } else {
            credentials = WalletUtils.loadCredentials(
                    properties.resolveKeystorePassword(), properties.getKeystorePath().toFile());
        }
        if (!credentials.getAddress().equalsIgnoreCase(properties.getAddress())) {
            throw new IllegalStateException("Operator address " + credentials.getAddress()
                    + " does not match blockchain.operator.address " + properties.getAddress());
        }
        return credentials;
    }

    @Bean
    OperatorTransactionGateway operatorTransactionGateway(
            Web3j web3j,
            Credentials credentials,
            OperatorSignerProperties properties) {
        return new Web3jOperatorTransactionGateway(web3j, credentials, properties);
    }

    @Bean
    OperatorTransactionDispatcher operatorTransactionDispatcher(
            BlockchainTransactionRepository repository,
            OperatorTransactionGateway gateway,
            BlockchainProperties blockchainProperties,
            PlatformTransactionManager transactionManager,
            iuh.fit.contract_service.service.OperationalFundingPolicy fundingPolicy) {
        return new OperatorTransactionDispatcher(repository, gateway, blockchainProperties, transactionManager, fundingPolicy);
    }

    @Bean
    BlockchainReceiptWatcher blockchainReceiptWatcher(
            BlockchainTransactionRepository repository,
            OperatorTransactionGateway gateway,
            BlockchainProperties blockchainProperties,
            PlatformTransactionManager transactionManager) {
        return new BlockchainReceiptWatcher(
                repository, gateway, blockchainProperties, transactionManager);
    }

    @Bean
    BlockchainTransactionRuntimeWorker blockchainTransactionRuntimeWorker(
            OperatorTransactionDispatcher dispatcher,
            BlockchainReceiptWatcher receiptWatcher,
            BlockchainProperties blockchainProperties) {
        return new BlockchainTransactionRuntimeWorker(dispatcher, receiptWatcher, blockchainProperties);
    }

    @Bean
    ApplicationRunner blockchainWriteRuntimeLogger(
            BlockchainProperties blockchainProperties,
            OperatorSignerProperties operatorProperties,
            iuh.fit.contract_service.blockchain.EduConnectEscrowReadGateway readGateway,
            Web3j web3j) {
        return args -> {
            readGateway.validateConfiguration();
            readGateway.requireOperatorRoles(operatorProperties.getAddress());
            var balance = web3j.ethGetBalance(operatorProperties.getAddress(),
                    org.web3j.protocol.core.DefaultBlockParameterName.LATEST).send();
            if (balance.hasError() || balance.getBalance().signum() == 0) {
                throw new IllegalStateException("Cannot start escrow operator without a verified ETH gas balance");
            }
            log.info(
                "Blockchain write runtime enabled for chainId={} operator={} dispatchBatch={} receiptBatch={} confirmations={} staleTimeoutMs={}",
                blockchainProperties.getChainId(),
                operatorProperties.getAddress(),
                blockchainProperties.getDispatcherBatchSize(),
                blockchainProperties.getReceiptWatchBatchSize(),
                blockchainProperties.getConfirmations(),
                blockchainProperties.getTransactionStaleTimeoutMs());
        };
    }
}
