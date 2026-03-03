# Local-First Attachments Implementation

This document explains how image and document sharing works in Meerkat's local-first architecture.

## Overview

Instead of uploading files to Supabase Storage, Meerkat uses a true local-first approach where files are stored directly in the CRDT (Conflict-free Replicated Data Type) as base64-encoded data.

## Architecture

### File Storage Flow

1. **File Selection**: User selects an image or document via the FAB
2. **Local Processing**: File is converted to base64 using FileReader API
3. **CRDT Storage**: Base64 data is stored in the `sharedDen.chatThread` array
4. **Real-time Sync**: Changes are automatically synced via WebRTC to other den participants
5. **Local Persistence**: Data is persisted to IndexedDB via y-indexeddb

### Data Structure

```typescript
interface ChatMessageData {
  id: string;
  userId: string;
  kind: "text" | "image" | "document" | "voice";
  text: string | null; // caption or message content
  attachmentPath?: string | null; // logical path for organization
  attachmentName?: string | null; // original filename
  attachmentMime?: string | null; // file type
  attachmentSize?: number | null; // file size in bytes
  attachmentData?: string | null; // base64 encoded file data
  sender: { /* sender info */ };
  createdAt: number;
}
```

## Benefits

### ✅ True Local-First
- **No external dependencies**: Files work offline without any server
- **Instant availability**: No upload delays, files appear immediately
- **Privacy**: Files never leave the user's device unless shared via P2P

### ✅ Real-time Collaboration
- **WebRTC sync**: Files automatically sync to other den participants
- **Conflict resolution**: CRDT handles concurrent edits automatically
- **Offline support**: Works without internet connection

### ✅ Data Ownership
- **User control**: Files are stored in user's local IndexedDB
- **No vendor lock-in**: Data isn't tied to external storage services
- **Portability**: Complete den can be exported/imported as needed

## Implementation Details

### File Processing

```typescript
const uploadAttachment = async (file: File): Promise<{
  path: string;
  size: number;
  mime: string;
  name: string;
  data: string; // base64 encoded
}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      // Generate logical path for organization
      const path = `${denId}/${userId}/${timestamp}-${random}.${ext}`;
      resolve({ path, size: file.size, mime: file.type, name: file.name, data: base64Data });
    };
    reader.readAsDataURL(file);
  });
};
```

### Message Creation

```typescript
const msg = {
  id: crypto.randomUUID(),
  userId: currentUserId,
  kind: "image" as const,
  text: caption ?? null,
  attachmentPath: path,
  attachmentName: name,
  attachmentMime: mime,
  attachmentSize: size,
  attachmentData: data, // base64 data stored in CRDT
  createdAt: Date.now(),
  sender: { /* sender info */ }
};

// Store in CRDT for real-time sync
sharedDen.ydoc.transact(() => {
  sharedDen.chatThread.push([msg]);
});
```

## Performance Considerations

### File Size Limits
- **Recommended**: Images < 10MB, Documents < 50MB
- **Technical limit**: Limited by IndexedDB and browser memory
- **Optimization**: Consider image compression for large files

### Storage Efficiency
- **Base64 overhead**: ~33% increase over binary size
- **Compression**: Browser automatically compresses IndexedDB
- **Cleanup**: Old attachments can be pruned via den management

## Comparison with Traditional Approach

| Aspect | Local-First (CRDT) | Traditional (Supabase) |
|--------|-------------------|------------------------|
| **Offline Support** | ✅ Full | ❌ Requires network |
| **Upload Speed** | ✅ Instant | ❌ Upload delay |
| **Privacy** | ✅ Local only | ❌ Server storage |
| **Reliability** | ✅ No SPOF | ❌ Dependent on service |
| **Scalability** | ⚠️ Browser limits | ✅ Cloud storage |
| **Cost** | ✅ Free | ❌ Storage fees |

## Future Enhancements

### Planned Optimizations
1. **Compression**: Client-side image compression before base64 encoding
2. **Lazy Loading**: Load large attachments on demand
3. **External Sync**: Optional cloud backup for large files
4. **Thumbnails**: Generate smaller preview versions

### Storage Management
1. **Cleanup Tools**: Remove old/large attachments
2. **Storage Monitoring**: Track IndexedDB usage
3. **Export Options**: Download attachments separately

## Security Considerations

### Data Protection
- **Local encryption**: Files can be encrypted before CRDT storage
- **Access control**: CRDT permissions control who can see attachments
- **Privacy**: No third-party access to file data

### Sharing Safety
- **WebRTC security**: Encrypted peer-to-peer connections
- **Capability keys**: Granular access control
- **Content scanning**: Optional malware scanning for shared files

---

**Status**: ✅ Implemented and tested  
**Version**: 1.0  
**Last Updated**: March 2026
