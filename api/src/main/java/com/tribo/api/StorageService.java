package com.tribo.api;

import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;

import java.io.InputStream;
import java.util.UUID;

/**
 * Service to handle uploading media files to Google Cloud Storage.
 */
public class StorageService {

    private static final String BUCKET_NAME = "tribo-497810-media";
    private static final Storage STORAGE = StorageOptions.getDefaultInstance().getService();

    /**
     * Uploads an image to GCS and returns its public URL.
     *
     * @param inputStream the file content
     * @param contentType the MIME type of the file (e.g. "image/jpeg")
     * @return the public URL of the uploaded image
     */
    public static String uploadImage(InputStream inputStream, String contentType) {
        try {
            // Generate a random UUID for the file name to avoid collisions
            String fileName = UUID.randomUUID().toString();
            
            // Determine file extension from content type if possible, or just default to .jpg
            String ext = "";
            if (contentType != null) {
                if (contentType.equals("image/png")) ext = ".png";
                else if (contentType.equals("image/jpeg")) ext = ".jpg";
                else if (contentType.equals("image/webp")) ext = ".webp";
            }
            if (!ext.isEmpty()) {
                fileName += ext;
            }

            BlobId blobId = BlobId.of(BUCKET_NAME, fileName);
            BlobInfo blobInfo = BlobInfo.newBuilder(blobId)
                    .setContentType(contentType)
                    .build();

            // Storage.create handles closing the input stream
            STORAGE.createFrom(blobInfo, inputStream);

            return "https://storage.googleapis.com/" + BUCKET_NAME + "/" + fileName;
        } catch (Exception e) {
            throw new RuntimeException("Failed to upload image to Google Cloud Storage", e);
        }
    }
}
