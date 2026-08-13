package iuh.fit.account_service.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    public EmailService(ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSenderProvider = mailSenderProvider;
    }

    public void sendVerificationOtp(String email, String otp) {
        sendOtp(email, otp, "EduConnect - Email Verification");
    }

    public void sendPasswordResetOtp(String email, String otp) {
        sendOtp(email, otp, "EduConnect - Password Reset");
    }

    private void sendOtp(String email, String otp, String subject) {
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();

        if (mailSender == null) {
            log.warn("Mail sender is not configured. OTP email was not sent for {}", email);
            return;
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setSubject(subject);
        message.setText(
                "Your verification OTP is: " + otp
                        + "\n\n"
                        + "This OTP will expire in 5 minutes."
        );

        mailSender.send(message);
    }
}
