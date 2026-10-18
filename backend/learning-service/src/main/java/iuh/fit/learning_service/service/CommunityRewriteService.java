package iuh.fit.learning_service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import iuh.fit.learning_service.config.security.LearningUserPrincipal;
import iuh.fit.learning_service.dto.CommunityPostDtos.AiRewritePostRequest;
import iuh.fit.learning_service.dto.CommunityPostDtos.AiRewritePostResponse;
import iuh.fit.learning_service.dto.CommunityPostDtos.CreatePostRequest;
import iuh.fit.learning_service.entity.CommunityPost;
import iuh.fit.learning_service.entity.CommunityPostPendingRevision;
import iuh.fit.learning_service.enums.CommunityModerationStatus;
import iuh.fit.learning_service.exception.ConflictException;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.repository.CommunityPostPendingRevisionRepository;
import iuh.fit.learning_service.repository.CommunityPostRepository;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
public class CommunityRewriteService {
    private static final Set<CommunityModerationStatus> ELIGIBLE = Set.of(
            CommunityModerationStatus.NEEDS_EDIT, CommunityModerationStatus.REJECTED);

    private final CommunityPostRepository postRepository;
    private final CommunityPostPendingRevisionRepository pendingRepository;
    private final CommunityRewriteClient client;
    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

    public CommunityRewriteService(CommunityPostRepository postRepository,
                                   CommunityPostPendingRevisionRepository pendingRepository,
                                   CommunityRewriteClient client) {
        this.postRepository = postRepository;
        this.pendingRepository = pendingRepository;
        this.client = client;
    }

    public AiRewritePostResponse rewrite(Long postId, AiRewritePostRequest request, LearningUserPrincipal principal) {
        if (principal == null || principal.userId() == null) {
            throw new ForbiddenException("Vui lòng đăng nhập để dùng gợi ý chỉnh sửa");
        }
        Source source = loadSource(postId, principal.userId());
        if (request == null || request.getContentRevision() == null
                || !Objects.equals(request.getContentRevision(), source.revision())) {
            throw new ConflictException("Nội dung đã thay đổi. Vui lòng tải lại và tạo gợi ý mới");
        }
        CommunityRewriteClient.Result result = client.rewrite(new CommunityRewriteClient.Request(
                source.post().getPostType().name(), source.title(), source.content(), source.status().name(),
                splitCategories(source.categories()), source.reason()));

        Source current = loadSource(postId, principal.userId());
        if (current.pendingEdit() != source.pendingEdit() || current.revision() != source.revision()
                || current.status() != source.status() || !Objects.equals(current.title(), source.title())
                || !Objects.equals(current.content(), source.content())) {
            throw new ConflictException("Nội dung đã thay đổi. Vui lòng tải lại và tạo gợi ý mới");
        }
        return AiRewritePostResponse.builder()
                .postId(postId)
                .sourceRevision(source.revision())
                .pendingEdit(source.pendingEdit())
                .canRewrite(result.canRewrite())
                .suggestedTitle(result.suggestedTitle())
                .suggestedContent(result.suggestedContent())
                .summaryOfChanges(result.summaryOfChanges())
                .build();
    }

    private Source loadSource(Long postId, Long userId) {
        CommunityPost post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài viết"));
        if (!Objects.equals(post.getAuthorId(), userId)) {
            throw new ForbiddenException("Bạn không có quyền tạo gợi ý cho bài viết này");
        }
        CommunityPostPendingRevision pending = pendingRepository.findById(postId).orElse(null);
        if (pending != null) {
            ensureEligible(pending.getModerationStatus());
            CreatePostRequest content = readPending(pending.getRequestJson());
            return new Source(post, content.getTitle().trim(), content.getContent().trim(),
                    pending.getContentRevision(), pending.getModerationStatus(), pending.getModerationCategories(),
                    pending.getModerationReason(), true);
        }
        ensureEligible(post.getModerationStatus());
        return new Source(post, post.getTitle(), post.getContent(), post.getContentRevision(),
                post.getModerationStatus(), post.getModerationCategories(), post.getModerationReason(), false);
    }

    private void ensureEligible(CommunityModerationStatus status) {
        if (!ELIGIBLE.contains(status)) {
            throw new ConflictException("Chỉ nội dung cần chỉnh sửa hoặc bị từ chối mới có thể dùng AI gợi ý");
        }
    }

    private CreatePostRequest readPending(String json) {
        try {
            return mapper.readValue(json, CreatePostRequest.class);
        } catch (Exception ex) {
            throw new IllegalStateException("Không thể đọc bản chỉnh sửa đang chờ kiểm duyệt", ex);
        }
    }

    private List<String> splitCategories(String categories) {
        return categories == null || categories.isBlank() ? List.of()
                : Arrays.stream(categories.split(",")).map(String::trim).filter(value -> !value.isBlank()).toList();
    }

    private record Source(CommunityPost post, String title, String content, long revision,
                          CommunityModerationStatus status, String categories, String reason, boolean pendingEdit) {}
}
