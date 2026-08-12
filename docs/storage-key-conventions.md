# Object storage key conventions

S3 has a flat object namespace. EduConnect uses slash-delimited prefixes as logical folders. Object names always include a UUID, so files with identical names never overwrite each other.

## Account Service

```text
tutor-applications/{userId}/certificates/{yyyy}/{MM}/{objectUuid}-{safeFileName}
users/{userId}/avatars/{yyyy}/{MM}/{objectUuid}-{safeFileName}
```

`tutor-applications/.../certificates` is reserved exclusively for tutor evidence (certificate or degree). It must never be reused for chat attachments.

Only Account Service writes these prefixes. Certificate objects are private and are read through an authorized Account Service endpoint.

## Notification Service (chat phase)

```text
chat/direct/{conversationId}/{yyyy}/{MM}/{messageId}/{objectUuid}-{safeFileName}
chat/group/{conversationId}/{yyyy}/{MM}/{messageId}/{objectUuid}-{safeFileName}
```

Chat metadata should store `objectKey`, `originalFileName`, `contentType`, `size`, uploader ID and message ID in PostgreSQL. Notification Service owns access checks and signed/download URLs. Images, video and generic files use the same prefix; `contentType` is the media discriminator.

The `direct` and `group` prefixes intentionally separate 1-1 chat from group chat. Do not create generic prefixes such as `uploads/` or `files/`; each service and business purpose must have its own prefix.

## Learning Service (later phases)

```text
classrooms/{classroomId}/assignments/{assignmentId}/{objectUuid}-{safeFileName}
classrooms/{classroomId}/submissions/{submissionId}/{objectUuid}-{safeFileName}
```

Do not put service-owned database IDs under another service's prefix. Do not make buckets public; expose short-lived URLs or authenticated streaming endpoints.
