package iuh.fit.contract_service.config;

import iuh.fit.contract_service.blockchain.BlockchainNetworkSnapshot;
import iuh.fit.contract_service.blockchain.BlockchainRpcClient;
import iuh.fit.contract_service.blockchain.EduConnectEscrowReadGateway;
import iuh.fit.contract_service.blockchain.Web3jBlockchainRpcClient;
import iuh.fit.contract_service.blockchain.EduConnectEscrowEventDecoder;
import iuh.fit.contract_service.repository.BlockchainEventCursorRepository;
import iuh.fit.contract_service.repository.ProcessedEventRepository;
import iuh.fit.contract_service.service.BlockchainEventIngestionService;
import iuh.fit.contract_service.service.BlockchainEventPollingWorker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.http.HttpService;
import org.springframework.transaction.PlatformTransactionManager;
import tools.jackson.databind.ObjectMapper;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(prefix = "blockchain", name = "enabled", havingValue = "true")
@EnableScheduling
public class BlockchainReadConfiguration {
    private static final Logger log = LoggerFactory.getLogger(BlockchainReadConfiguration.class);

    @Bean(destroyMethod = "shutdown")
    Web3j web3j(BlockchainProperties properties) {
        return Web3j.build(new HttpService(properties.getRpcUrl().toString()));
    }

    @Bean
    Web3jBlockchainRpcClient blockchainRpcClient(Web3j web3j) {
        return new Web3jBlockchainRpcClient(web3j);
    }

    @Bean
    EduConnectEscrowReadGateway eduConnectEscrowReadGateway(
            BlockchainProperties properties,
            BlockchainRpcClient rpcClient) {
        return new EduConnectEscrowReadGateway(properties, rpcClient);
    }

    @Bean
    EduConnectEscrowEventDecoder eduConnectEscrowEventDecoder() {
        return new EduConnectEscrowEventDecoder();
    }

    @Bean
    BlockchainEventIngestionService blockchainEventIngestionService(
            BlockchainProperties properties,
            Web3jBlockchainRpcClient rpcClient,
            EduConnectEscrowEventDecoder decoder,
            BlockchainEventCursorRepository cursorRepository,
            ProcessedEventRepository eventRepository,
            ObjectMapper objectMapper,
            PlatformTransactionManager transactionManager) {
        return new BlockchainEventIngestionService(
                properties,
                rpcClient,
                decoder,
                cursorRepository,
                eventRepository,
                objectMapper,
                transactionManager);
    }

    @Bean
    BlockchainEventPollingWorker blockchainEventPollingWorker(
            BlockchainEventIngestionService ingestionService) {
        return new BlockchainEventPollingWorker(ingestionService);
    }

    @Bean
    ApplicationRunner blockchainConfigurationValidator(EduConnectEscrowReadGateway gateway) {
        return arguments -> {
            BlockchainNetworkSnapshot snapshot = gateway.validateConfiguration();
            log.info(
                    "Validated read-only blockchain configuration: chainId={}, escrow={}, token={}, decimals={}, platform={}",
                    snapshot.chainId(),
                    snapshot.escrowAddress(),
                    snapshot.tokenAddress(),
                    snapshot.tokenDecimals(),
                    snapshot.platformWallet());
        };
    }
}
