package iuh.fit.account_service.modules.auth.legacy.repository;

import iuh.fit.account_service.modules.auth.legacy.entity.OtpVerification;
import iuh.fit.account_service.modules.auth.legacy.enums.OtpType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.NoRepositoryBean;

import java.util.Optional;

@NoRepositoryBean
public interface OtpVerificationRepository extends JpaRepository<OtpVerification, Long> {

    Optional<OtpVerification> findTopByUserIdAndTypeOrderByCreatedAtDesc(
            Long userId,
            OtpType type
    );
}
