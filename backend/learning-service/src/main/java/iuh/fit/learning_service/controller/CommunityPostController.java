package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.config.security.LearningUserPrincipal;
import iuh.fit.learning_service.dto.CommunityPostDtos.*;
import iuh.fit.learning_service.enums.LearningMode;
import iuh.fit.learning_service.enums.PostStatus;
import iuh.fit.learning_service.enums.PostType;
import iuh.fit.learning_service.service.CommunityPostService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import iuh.fit.learning_service.dto.TutorFollowDtos.*;
import iuh.fit.learning_service.service.TutorFollowService;
import org.springframework.validation.annotation.Validated;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/community")
@Validated
public class CommunityPostController {

    private final CommunityPostService postService;
    private final TutorFollowService tutorFollowService;

    public CommunityPostController(CommunityPostService postService, TutorFollowService tutorFollowService) {
        this.postService = postService;
        this.tutorFollowService = tutorFollowService;
    }

    private LearningUserPrincipal extractPrincipal(Authentication auth) {
        if (auth != null && auth.getPrincipal() instanceof LearningUserPrincipal principal) {
            return principal;
        }
        return null;
    }

    private Long extractUserId(Authentication auth) {
        LearningUserPrincipal principal = extractPrincipal(auth);
        return principal != null ? principal.userId() : null;
    }

    @GetMapping("/posts")
    public ResponseEntity<Page<PostSummaryDto>> getPosts(
            @RequestParam(required = false) PostType postType,
            @RequestParam(required = false) PostStatus status,
            @RequestParam(required = false) Long subjectId,
            @RequestParam(required = false) LearningMode learningMode,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Boolean followingOnly,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size,
            Authentication authentication
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Long currentUserId = extractUserId(authentication);
        return ResponseEntity.ok(postService.searchPosts(postType, status, subjectId, learningMode, keyword, followingOnly, pageable, currentUserId));
    }

    @GetMapping("/posts/{id}")
    public ResponseEntity<PostSummaryDto> getPostDetail(
            @PathVariable Long id,
            Authentication authentication
    ) {
        Long currentUserId = extractUserId(authentication);
        return ResponseEntity.ok(postService.getPostDetail(id, currentUserId));
    }

    @GetMapping("/posts/shared/{publicShareId}")
    public ResponseEntity<PostSummaryDto> getSharedPost(
            @PathVariable UUID publicShareId,
            Authentication authentication
    ) {
        return ResponseEntity.ok(postService.getSharedPost(publicShareId, extractUserId(authentication)));
    }

    @GetMapping("/posts/mine")
    public ResponseEntity<Page<PostSummaryDto>> getMyPosts(
            @RequestParam(required = false) PostStatus status,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size,
            Authentication authentication
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(postService.getMyPosts(status, pageable, extractPrincipal(authentication)));
    }

    @GetMapping("/posts/bookmarked")
    public ResponseEntity<Page<PostSummaryDto>> getBookmarkedPosts(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size,
            Authentication authentication
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(postService.getBookmarkedPosts(pageable, extractPrincipal(authentication)));
    }

    @PostMapping("/posts")
    public ResponseEntity<PostSummaryDto> createPost(
            @Valid @RequestBody CreatePostRequest request,
            Authentication authentication
    ) {
        LearningUserPrincipal principal = extractPrincipal(authentication);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(postService.createPost(request, principal, null, null));
    }

    @PutMapping("/posts/{id}")
    public ResponseEntity<PostSummaryDto> updatePost(
            @PathVariable Long id,
            @Valid @RequestBody CreatePostRequest request,
            Authentication authentication
    ) {
        LearningUserPrincipal principal = extractPrincipal(authentication);
        return ResponseEntity.ok(postService.updatePost(id, request, principal));
    }

    @DeleteMapping("/posts/{id}")
    public ResponseEntity<Void> deletePost(
            @PathVariable Long id,
            Authentication authentication
    ) {
        LearningUserPrincipal principal = extractPrincipal(authentication);
        boolean isAdmin = authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        postService.deletePost(id, principal, isAdmin);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/posts/{id}/close")
    public ResponseEntity<PostSummaryDto> closePost(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(postService.closePost(id, extractPrincipal(authentication)));
    }

    @PostMapping("/polls/{pollId}/vote")
    public ResponseEntity<PollSummaryDto> votePoll(
            @PathVariable Long pollId,
            @Valid @RequestBody VotePollRequest request,
            Authentication authentication
    ) {
        LearningUserPrincipal principal = extractPrincipal(authentication);
        return ResponseEntity.ok(postService.votePoll(pollId, request.getOptionId(), principal, null));
    }

    @PutMapping("/polls/{pollId}/votes")
    public ResponseEntity<PollSummaryDto> updatePollVotes(
            @PathVariable Long pollId,
            @Valid @RequestBody UpdatePollVotesRequest request,
            Authentication authentication
    ) {
        LearningUserPrincipal principal = extractPrincipal(authentication);
        return ResponseEntity.ok(postService.updatePollVotes(pollId, request.getOptionIds(), principal, null));
    }

    @DeleteMapping("/polls/{pollId}/vote")
    public ResponseEntity<PollSummaryDto> unvotePoll(
            @PathVariable Long pollId,
            Authentication authentication
    ) {
        LearningUserPrincipal principal = extractPrincipal(authentication);
        return ResponseEntity.ok(postService.unvotePoll(pollId, principal));
    }

    @GetMapping("/posts/{id}/likes")
    public ResponseEntity<java.util.List<LikeUserDto>> getPostLikes(
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(postService.getPostLikes(id));
    }

    @PostMapping("/posts/{id}/reactions")
    public ResponseEntity<Boolean> toggleReaction(
            @PathVariable Long id,
            @RequestParam(required = false) String userName,
            @RequestParam(required = false) String userAvatar,
            Authentication authentication
    ) {
        LearningUserPrincipal principal = extractPrincipal(authentication);
        boolean isLiked = postService.toggleLike(id, principal, userName, userAvatar);
        return ResponseEntity.ok(isLiked);
    }

    @PostMapping("/posts/{id}/bookmarks")
    public ResponseEntity<Boolean> toggleBookmark(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(postService.toggleBookmark(id, extractPrincipal(authentication)));
    }

    @GetMapping("/posts/{id}/comments")
    public ResponseEntity<Page<CommentDto>> getComments(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").ascending());
        return ResponseEntity.ok(postService.getComments(id, pageable));
    }

    @PostMapping("/posts/{id}/comments")
    public ResponseEntity<CommentDto> addComment(
            @PathVariable Long id,
            @Valid @RequestBody CreateCommentRequest request,
            Authentication authentication
    ) {
        LearningUserPrincipal principal = extractPrincipal(authentication);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(postService.addComment(
                        id,
                        request.getCommentText(),
                        principal,
                        request.getUserName(),
                        request.getUserAvatar(),
                        request.getReplyToUserId(),
                        request.getReplyToUserRole(),
                        request.getReplyToUserName()));
    }

    @PostMapping("/posts/{id}/convert-to-class")
    public ResponseEntity<ClassCreatedFromPostResponse> convertPostToClass(
            @PathVariable Long id,
            @Valid @RequestBody ConvertPostToClassRequest request,
            Authentication authentication
    ) {
        LearningUserPrincipal principal = extractPrincipal(authentication);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(postService.convertPostToClass(id, request, principal, null));
    }

    @GetMapping("/posts/{id}/class-suggestion")
    public ClassSuggestionResponse getClassSuggestion(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return postService.getClassSuggestion(id, extractPrincipal(authentication));
    }

    @PutMapping("/tutors/{tutorUserId}/follow")
    public ResponseEntity<FollowStatusResponse> followTutor(
            @PathVariable Long tutorUserId,
            Authentication authentication
    ) {
        LearningUserPrincipal principal = extractPrincipal(authentication);
        return ResponseEntity.ok(tutorFollowService.followTutor(tutorUserId, principal));
    }

    @DeleteMapping("/tutors/{tutorUserId}/follow")
    public ResponseEntity<FollowStatusResponse> unfollowTutor(
            @PathVariable Long tutorUserId,
            Authentication authentication
    ) {
        LearningUserPrincipal principal = extractPrincipal(authentication);
        return ResponseEntity.ok(tutorFollowService.unfollowTutor(tutorUserId, principal));
    }

    @GetMapping("/tutors/{tutorUserId}/follow-status")
    public ResponseEntity<FollowStatusResponse> getFollowStatus(
            @PathVariable Long tutorUserId,
            Authentication authentication
    ) {
        Long currentUserId = extractUserId(authentication);
        return ResponseEntity.ok(tutorFollowService.getFollowStatus(tutorUserId, currentUserId));
    }

    @GetMapping("/following-tutors")
    public ResponseEntity<List<FollowingTutorSummaryDto>> getFollowingTutors(
            Authentication authentication
    ) {
        LearningUserPrincipal principal = extractPrincipal(authentication);
        return ResponseEntity.ok(tutorFollowService.getFollowingTutors(principal));
    }

    @GetMapping("/tutors/{tutorUserId}/followers")
    public ResponseEntity<Page<FollowerSummaryDto>> getTutorFollowers(
            @PathVariable Long tutorUserId,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            Authentication authentication
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        LearningUserPrincipal principal = extractPrincipal(authentication);
        return ResponseEntity.ok(tutorFollowService.getFollowers(tutorUserId, pageable, principal));
    }
}
