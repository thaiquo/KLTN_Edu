package iuh.fit.authservice.modules.auth.mapper;

import iuh.fit.authservice.modules.auth.dto.response.AccountProfileResponse;
import iuh.fit.authservice.modules.auth.dto.response.AccountResponse;
import iuh.fit.authservice.modules.auth.dto.response.SessionResponse;
import iuh.fit.authservice.modules.auth.entity.Account;
import iuh.fit.authservice.modules.auth.entity.AccountProfile;
import iuh.fit.authservice.modules.auth.entity.Session;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface AccountMapper {

    @Mapping(target = "profile", expression = "java(toProfileResponse(account.getProfile()))")
    AccountResponse toAccountResponse(Account account);

    AccountProfileResponse toProfileResponse(AccountProfile profile);

    SessionResponse toSessionResponse(Session session);
}