package iuh.fit.notification_service.service;

import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class EmailNotificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailNotificationService.class);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    public EmailNotificationService(ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSenderProvider = mailSenderProvider;
    }

    @Async
    public void sendNotificationEmailAsync(String recipientEmail, String title, String content, String type, String referenceId) {
        if (recipientEmail == null || recipientEmail.isBlank() || !recipientEmail.contains("@")) {
            return;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.info("JavaMailSender not configured. Skipped sending email to {} with title '{}'", recipientEmail, title);
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom("EduConnect Platform <no-reply@educonnect.vn>");
            helper.setTo(recipientEmail.trim());
            helper.setSubject("【EduConnect】" + title);

            String htmlBody = buildHtmlEmailTemplate(title, content, type, referenceId);
            helper.setText(htmlBody, true);

            mailSender.send(message);
            log.info("Successfully sent notification email to {} for type {}", recipientEmail, type);
        } catch (Exception e) {
            log.warn("Could not send email to {}: {}", recipientEmail, e.getMessage());
        }
    }

    private String buildHtmlEmailTemplate(String title, String content, String type, String referenceId) {
        String badgeColor = "#0284c7";
        String badgeText = "THÔNG BÁO HỆ THỐNG";

        if ("AGREEMENT_PENDING_STUDENT".equalsIgnoreCase(type)) {
            badgeColor = "#f59e0b";
            badgeText = "HỢP ĐỒNG ĐANG CHỜ KÝ";
        } else if ("AGREEMENT_WAITING_PAYMENT".equalsIgnoreCase(type)) {
            badgeColor = "#ea580c";
            badgeText = "GIỮ CHỖ 24 GIỜ";
        } else if ("AGREEMENT_REGISTERED".equalsIgnoreCase(type) || "AGREEMENT_ACTIVATED".equalsIgnoreCase(type)) {
            badgeColor = "#10b981";
            badgeText = "LỚP HỌC KÍCH HOẠT";
        }

        return """
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>%s</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
            .header { background: linear-gradient(135deg, #0284c7 0%%, #4f46e5 100%%); padding: 30px 24px; text-align: center; color: #ffffff; }
            .header h1 { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; background: %s; color: #ffffff; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 12px; }
            .body { padding: 32px 28px; line-height: 1.6; }
            .title { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 14px; }
            .content { font-size: 14px; color: #475569; margin-bottom: 24px; background: #f8fafc; padding: 18px; border-radius: 14px; border-left: 4px solid #0284c7; }
            .cta-btn { display: inline-block; background: linear-gradient(135deg, #0284c7 0%%, #4f46e5 100%%); color: #ffffff !important; font-weight: 800; font-size: 13px; text-decoration: none; padding: 12px 28px; border-radius: 12px; box-shadow: 0 2px 4px rgba(2,132,199,0.25); text-align: center; }
            .footer { padding: 20px 28px; background: #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="badge">%s</div>
              <h1>EduConnect Platform</h1>
            </div>
            <div class="body">
              <h2 class="title">%s</h2>
              <div class="content">%s</div>
              <div style="text-align: center; margin-top: 24px;">
                <a href="http://localhost:5173" class="cta-btn">Truy Cập Nền Tảng EduConnect</a>
              </div>
            </div>
            <div class="footer">
              <p>Email này được gửi tự động từ Hệ thống Hợp đồng & Ký quỹ Blockchain EduConnect.</p>
              <p>© 2026 EduConnect. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
        """.formatted(title, badgeColor, badgeText, title, content);
    }
}
