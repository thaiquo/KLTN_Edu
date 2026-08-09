package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.OtpVerification;
import iuh.fit.account_service.enums.OtpType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OtpVerificationRepository extends JpaRepository<OtpVerification, Long> {

    Optional<OtpVerification> findTopByUserIdAndTypeOrderByCreatedAtDesc(
            Long userId,
            OtpType type
    );
}
