package iuh.fit.contract_service.config;

import iuh.fit.contract_service.blockchain.OperatorTransactionGateway;
import iuh.fit.contract_service.blockchain.Web3jOperatorTransactionGateway;
import iuh.fit.contract_service.repository.BlockchainTransactionRepository;
import iuh.fit.contract_service.service.BlockchainReceiptWatcher;
import iuh.fit.contract_service.service.OperatorTransactionDispatcher;
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
    @Bean
    Credentials operatorCredentials(OperatorSignerProperties properties) throws Exception {
        Credentials credentials = WalletUtils.loadCredentials(
                properties.getKeystorePassword(), properties.getKeystorePath().toFile());
        if (!credentials.getAddress().equalsIgnoreCase(properties.getAddress())) {
            throw new IllegalStateException("Operator keystore address does not match blockchain.operator.address");
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
            PlatformTransactionManager transactionManager) {
        return new OperatorTransactionDispatcher(repository, gateway, transactionManager);
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
}
