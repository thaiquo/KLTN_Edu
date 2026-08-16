package iuh.fit.account_service.config.security;

import iuh.fit.account_service.entity.Tutor;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.enums.TutorStatus;
import iuh.fit.account_service.repository.StudentRepository;
import iuh.fit.account_service.repository.TutorRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final StudentRepository studentRepository;
    private final TutorRepository tutorRepository;

    public CustomUserDetailsService(
            UserRepository userRepository,
            UserRoleRepository userRoleRepository,
            StudentRepository studentRepository,
            TutorRepository tutorRepository
    ) {
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
        this.studentRepository = studentRepository;
        this.tutorRepository = tutorRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        return loadUserByUsernameAndActiveRole(email, null);
    }

    public UserDetails loadUserByUsernameAndActiveRole(String email, String activeRole) throws UsernameNotFoundException {
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        List<SimpleGrantedAuthority> authorities = new ArrayList<>();

        if (activeRole != null && !activeRole.isBlank()) {
            String roleUpper = activeRole.trim().toUpperCase();

            if ("STUDENT".equals(roleUpper)) {
                if (studentRepository.existsByUserId(user.getId())) {
                    authorities.add(new SimpleGrantedAuthority("ROLE_STUDENT"));
                }
            } else if ("TUTOR".equals(roleUpper)) {
                Optional<Tutor> tutorOpt = tutorRepository.findByUserId(user.getId());
                if (tutorOpt.isPresent() && tutorOpt.get().getStatus() == TutorStatus.APPROVED) {
                    authorities.add(new SimpleGrantedAuthority("ROLE_TUTOR"));
                }
                // If PENDING or REJECTED, user stays authenticated but without ROLE_TUTOR
            } else if ("STAFF".equals(roleUpper) || "ADMIN".equals(roleUpper)) {
                List<UserRole> userRoles = userRoleRepository.findByUserId(user.getId());
                userRoles.stream()
                        .filter(ur -> ur.getRole().name().equalsIgnoreCase(roleUpper))
                        .forEach(ur -> authorities.add(new SimpleGrantedAuthority("ROLE_" + ur.getRole().name())));
            }
        } else {
            // Fallback for legacy tokens without activeRole
            List<UserRole> userRoles = userRoleRepository.findByUserId(user.getId());
            for (UserRole userRole : userRoles) {
                authorities.add(new SimpleGrantedAuthority("ROLE_" + userRole.getRole().name()));
            }
        }

        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPassword(),
                user.isEmailVerified() && user.getAccountStatus() != AccountStatus.DISABLED,
                true,
                true,
                user.getAccountStatus() != AccountStatus.LOCKED,
                authorities
        );
    }
}
