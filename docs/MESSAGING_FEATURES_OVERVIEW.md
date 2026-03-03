# Meerkat Messaging Features Overview

This document provides a comprehensive overview of the messaging capabilities in Meerkat, including text messages, image sharing, and document sharing features.

## Overview

Meerkat supports multiple types of messaging through a unified interface:
- **Text Messages** - Rich text composition with real-time delivery
- **Image Sharing** - Photo uploads from device library with optional captions
- **Document Sharing** - File uploads with metadata and optional captions
- **Voice Messages** - Audio recordings (existing feature)

## Architecture

### Dual Implementation Approach

The codebase contains two parallel implementations:

1. **Enhanced Local-First Implementation** (`den-page-client-enhanced.tsx`)
   - Uses CRDT-based local-first architecture
   - Stores messages in `sharedDen.chatThread`
   - Uploads attachments to Supabase Storage
   - Full feature implementation

2. **Basic Supabase Implementation** (`den-page-client.tsx`)
   - Uses traditional Supabase database approach
   - Stores messages in `messages` table
   - Currently has placeholder functions for image/document sharing
   - Used for fallback compatibility

### Key Components

#### 1. Floating Action Button (FAB)
- **Location**: `apps/web/components/den/fab.tsx`
- **Purpose**: Primary entry point for all messaging actions
- **Actions Available**:
  - Voice message (orange)
  - Text message (brown)
  - Photo from library (blue)
  - Take a photo (green)
  - Document (purple)

#### 2. Text Composer Modal
- **Location**: `apps/web/components/den/text-composer-modal.tsx`
- **Features**:
  - Multi-line text input
  - Enter to send, Shift+Enter for new line
  - Loading states and error handling
  - Auto-focus on open

#### 3. Attachment Picker Modal
- **Location**: `apps/web/components/den/attachment-picker-modal.tsx`
- **Supports**: Images and documents
- **Features**:
  - File selection with type filtering
  - Optional caption input
  - File preview with name display
  - Upload progress and error handling

## Implementation Details

### Text Messages

#### Enhanced Implementation
```typescript
const handleSendText = async (content: string) => {
  const { sharedDen } = await openDen(activeDen.id);
  const msg = {
    id: crypto.randomUUID(),
    userId: currentUserId,
    kind: "text" as const,
    text: content,
    createdAt: Date.now(),
    sender: { /* user info */ }
  };
  sharedDen.ydoc.transact(() => {
    sharedDen.chatThread.push([msg]);
  });
};
```

#### Basic Implementation
```typescript
const sendText = useMutation({
  mutationFn: async ({ userId, content }) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("messages")
      .insert({
        den_id: denId,
        user_id: userId,
        type: "text",
        content,
        voice_url: null,
        voice_duration: null,
      })
      .select()
      .single();
    return data as Message;
  },
});
```

### Image & Document Sharing

#### Enhanced Implementation
Both image and document sharing follow the same pattern:

1. **File Upload**:
```typescript
const uploadAttachment = async (file: File): Promise<{
  path: string;
  size: number;
  mime: string;
  name: string;
}> => {
  const supabase = createClient();
  const ext = file.name.split(".").pop() ?? "bin";
  const safeExt = ext.toLowerCase();
  const path = `${activeDen.id}/${currentUserId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;

  const { error: uploadErr } = await supabase.storage
    .from("attachments")
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
    });
  
  return { path, size: file.size, mime: file.type, name: file.name };
};
```

2. **Message Creation**:
```typescript
const handleSendImage = async (file: File, caption?: string) => {
  const { path, size, mime, name } = await uploadAttachment(file);
  const { sharedDen } = await openDen(activeDen.id);
  const msg = {
    id: crypto.randomUUID(),
    userId: currentUserId,
    kind: "image" as const,
    text: caption ?? null,
    attachmentPath: path,
    attachmentName: name,
    attachmentMime: mime,
    attachmentSize: size,
    createdAt: Date.now(),
    sender: { /* user info */ }
  };
  sharedDen.ydoc.transact(() => {
    sharedDen.chatThread.push([msg]);
  });
};
```

#### Basic Implementation (Placeholder)
Currently shows error toast indicating feature not implemented:
```typescript
const sendImage = {
  mutateAsync: async ({ userId, file, caption }) => {
    toast.error("Image sharing not implemented yet");
    throw new Error("Image sharing not implemented");
  }
};
```

## Message Schema

### Enhanced (CRDT) Schema
```typescript
interface Message {
  id: string;
  userId: string;
  kind: "text" | "image" | "document" | "voice";
  text: string | null;
  attachmentPath?: string;
  attachmentName?: string;
  attachmentMime?: string;
  attachmentSize?: number;
  createdAt: number;
  sender: {
    full_name: string;
    preferred_name?: string;
    email: string;
  };
}
```

### Basic (Supabase) Schema
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  den_id UUID REFERENCES dens(id),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL, -- 'text', 'voice', 'image', 'document'
  content TEXT,
  voice_url TEXT,
  voice_duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Additional fields for attachments (to be added)
  attachment_path TEXT,
  attachment_name TEXT,
  attachment_mime TEXT,
  attachment_size BIGINT
);
```

## Storage Requirements

### Supabase Storage Buckets

1. **`attachments`** - For image and document files
   - Path pattern: `{denId}/{userId}/{timestamp}-{random}.{ext}`
   - Supported types: All file types for documents, image types for photos

2. **`voice-notes`** - Existing bucket for voice messages
   - Path pattern: `{denId}/{userId}/{timestamp}.webm`

## UI Flow

### User Interaction Flow

1. **User taps FAB** → Action menu expands
2. **User selects action type**:
   - Text → Opens TextComposerModal
   - Photo/Document → Opens AttachmentPickerModal
3. **User composes content**:
   - Text: Type message and send
   - Attachment: Select file, add optional caption, send
4. **System processes**:
   - Upload file to storage (if attachment)
   - Create message object
   - Add to chat thread via CRDT or database
   - Close modal

### Error Handling

- **Network errors**: Toast notification with retry option
- **File size limits**: Client-side validation before upload
- **Invalid file types**: Filtered by file input accept attribute
- **Storage quota**: Handled by Supabase with appropriate error messages

## Configuration

### Environment Variables

```env
# Supabase configuration (existing)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Additional storage configuration (if needed)
# Custom file size limits, allowed MIME types, etc.
```

### File Size Limits

- **Images**: Recommended < 10MB
- **Documents**: Recommended < 50MB
- **Voice notes**: Existing limit ~5MB

## Future Enhancements

### Planned Features

1. **Image Processing**
   - Automatic image compression
   - Thumbnail generation
   - EXIF data stripping for privacy

2. **Document Preview**
   - PDF preview generation
   - Office document thumbnails
   - Text file preview

3. **Advanced Features**
   - Message reactions
   - Message threading
   - Message editing/deletion
   - Read receipts

4. **Performance Optimizations**
   - Lazy loading of attachments
   - Progressive image loading
   - Caching strategies

### Migration Path

1. **Phase 1**: Complete basic implementation with database storage
2. **Phase 2**: Add file processing and preview capabilities
3. **Phase 3**: Implement advanced messaging features
4. **Phase 4**: Performance optimizations and scaling

## Security Considerations

### File Upload Security

- **File type validation**: Both client-side and server-side
- **Virus scanning**: Integration with security services
- **Access control**: Bucket policies ensure users only access their own files
- **Metadata sanitization**: Remove sensitive EXIF data from images

### Privacy

- **File paths**: Non-deterministic to prevent enumeration
- **Access tokens**: Signed URLs with expiration
- **Data retention**: Configurable cleanup policies

## Testing

### Test Coverage Areas

1. **Unit Tests**
   - Message creation functions
   - File upload utilities
   - Modal component behavior

2. **Integration Tests**
   - End-to-end message flow
   - File upload and retrieval
   - Error scenarios

3. **E2E Tests**
   - Complete user workflows
   - Cross-device synchronization
   - Performance under load

### Test Data

- Sample images of various sizes and formats
- Test documents (PDF, DOCX, TXT)
- Mock Supabase responses for offline testing

## Troubleshooting

### Common Issues

1. **Upload Failures**
   - Check Supabase storage bucket exists
   - Verify user has appropriate permissions
   - Check file size limits

2. **Message Not Appearing**
   - Verify CRDT synchronization
   - Check network connectivity
   - Review browser console for errors

3. **Modal Issues**
   - Ensure proper z-index stacking
   - Check for conflicting event handlers
   - Verify modal state management

### Debug Tools

- Browser DevTools for network requests
- Supabase dashboard for storage monitoring
- CRDT debugging tools for sync issues

---

**Last Updated**: March 2026  
**Version**: 1.0  
**Status**: Enhanced implementation complete, basic implementation in progress
