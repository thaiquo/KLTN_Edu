package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.OtpVerification;
import iuh.fit.account_service.enums.OtpType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface OtpVerificationRepository extends JpaRepository<OtpVerification, Long> {

    Optional<OtpVerification> findTopByUserIdAndTypeOrderByCreatedAtDesc(
            Long userId,
            OtpType type
    );

    Optional<OtpVerification> findTopByUserIdAndTypeAndVerifiedFalseAndInvalidatedFalseOrderByCreatedAtDesc(
            Long userId,
            OtpType type
    );

    @Modifying
    @Query("""
            update OtpVerification otp
            set otp.invalidated = true
            where otp.user.id = :userId
              and otp.type = :type
              and otp.verified = false
              and otp.invalidated = false
            """)
    int invalidateActiveOtps(Long userId, OtpType type);
}
