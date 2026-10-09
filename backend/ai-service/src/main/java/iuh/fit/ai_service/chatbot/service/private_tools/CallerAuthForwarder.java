package iuh.fit.ai_service.chatbot.service.private_tools;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Component
public class CallerAuthForwarder {
    public void apply(HttpHeaders headers) {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes == null) {
            return;
        }
        HttpServletRequest request = attributes.getRequest();
        forwardHeader(request, headers, HttpHeaders.COOKIE);
        forwardHeader(request, headers, HttpHeaders.AUTHORIZATION);
    }

    private void forwardHeader(HttpServletRequest request, HttpHeaders headers, String name) {
        String value = request.getHeader(name);
        if (StringUtils.hasText(value)) {
            headers.set(name, value);
        }
    }
}
