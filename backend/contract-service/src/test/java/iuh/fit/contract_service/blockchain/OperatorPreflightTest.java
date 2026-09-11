package iuh.fit.contract_service.blockchain;

import iuh.fit.contract_service.config.OperatorSignerProperties;
import org.junit.jupiter.api.Test;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.Response;
import org.web3j.protocol.core.methods.response.EthCall;
import org.web3j.protocol.core.methods.response.EthChainId;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class OperatorPreflightTest {
    @Test void rejectsWrongNetworkBeforeSigning() throws Exception {
        Web3j rpc = mock(Web3j.class, RETURNS_DEEP_STUBS);
        EthChainId chain = new EthChainId(); chain.setResult("0x1");
        when(rpc.ethChainId().send()).thenReturn(chain);
        var credentials = Credentials.create("1");
        var properties = new OperatorSignerProperties(); properties.setAddress(credentials.getAddress());
        var gateway = new Web3jOperatorTransactionGateway(rpc, credentials, properties);
        assertThrows(OperatorTransactionException.class,
                () -> gateway.prepare(11155111, credentials.getAddress(), credentials.getAddress(), "0x"));
        verify(rpc, never()).ethSendRawTransaction(anyString());
        verify(rpc, never()).ethGetTransactionCount(anyString(), any());
    }

    @Test void rejectsRevertingCallBeforeAllocatingNonceOrBroadcasting() throws Exception {
        Web3j rpc = mock(Web3j.class, RETURNS_DEEP_STUBS);
        EthChainId chain = new EthChainId(); chain.setResult("0xaa36a7");
        when(rpc.ethChainId().send()).thenReturn(chain);
        EthCall call = new EthCall(); call.setError(new Response.Error(3, "execution reverted"));
        when(rpc.ethCall(any(), any()).send()).thenReturn(call);
        var credentials = Credentials.create("1");
        var properties = new OperatorSignerProperties(); properties.setAddress(credentials.getAddress());
        var gateway = new Web3jOperatorTransactionGateway(rpc, credentials, properties);
        assertThrows(OperatorTransactionException.class,
                () -> gateway.prepare(11155111, credentials.getAddress(), credentials.getAddress(), "0x"));
        verify(rpc, never()).ethGetTransactionCount(anyString(), any());
        verify(rpc, never()).ethSendRawTransaction(anyString());
    }
}
