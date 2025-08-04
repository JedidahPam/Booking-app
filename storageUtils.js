import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { storage } from './firebaseConfig'; // Ensure firebaseConfig.js correctly initializes and exports 'storage'

/**
 * Upload an image file to Firebase Storage
 * @param {string} localUri - Local URI of the image (e.g., 'file:///path/to/image.jpg')
 * @param {string} folderPath - Storage folder path (e.g., 'profileImages', 'driverProfileImages')
 * @param {string} userId - User ID for organizing files (e.g., 'user123')
 * @param {string} oldImageUrl - Optional: URL of old image to delete before uploading new one
 * @returns {Promise<string>} - Download URL of the newly uploaded image
 */
export const uploadImageToStorage = async (localUri, folderPath, userId, oldImageUrl = null) => {
  try {
    if (!localUri || !folderPath || !userId) {
      throw new Error('Missing required parameters for image upload');
    }
    if (!localUri.startsWith('file://')) {
      throw new Error('Invalid image URI format. Expected file:// URI');
    }

    console.log('Attempting to fetch image data from local URI:', localUri);
    const response = await fetch(localUri);
    console.log('Fetch response status:', response.status);
    if (!response.ok) {
      throw new Error(`Failed to fetch image data. HTTP status: ${response.status} - ${response.statusText || 'Unknown Status'}`);
    }
    const blob = await response.blob();
    console.log('Blob created:', { size: blob.size, type: blob.type });

    if (blob.size === 0) {
        throw new Error('Fetched image blob is empty. Check local URI or image source.');
    }

    // Delete old image if provided
    if (oldImageUrl) {
      try {
        await deleteImageFromStorage(oldImageUrl);
        console.log('Old image deleted successfully');
      } catch (deleteError) {
        console.warn('Failed to delete old image:', deleteError.message);
        // Continue with upload even if old image deletion fails
      }
    }

    // Create unique filename with timestamp
    const timestamp = Date.now();
    const fileExtension = localUri.split('.').pop() || 'jpg';
    const filename = `profile_${timestamp}.${fileExtension}`;
    
    // Create storage reference
    const imageRef = ref(storage, `${folderPath}/${userId}/${filename}`);
    console.log('Uploading image to Firebase Storage...');

    // Upload the blob to Firebase Storage
    const snapshot = await uploadBytes(imageRef, blob);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log('Image uploaded successfully! Download URL:', downloadURL);
    return downloadURL;

  } catch (error) {
    console.error('Error during image upload:', {
      code: error.code || 'NO_UPLOAD_CODE',
      message: error.message,
      name: error.name,
      stack: error.stack,
      originalError: error,
    });
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};
/**
 * Delete an image from Firebase Storage using its full download URL.
 * @param {string} imageUrl - Full download URL of the image to delete.
 * @returns {Promise<void>}
 */
export const deleteImageFromStorage = async (imageUrl) => {
  try {
    if (!imageUrl) {
      console.log('No image URL provided for deletion. Skipping.');
      return;
    }

    // Parse the image URL to extract the storage path
    const url = new URL(imageUrl);
    // Regular expression to get the path part after '/o/' and before '?' (query parameters)
    const pathMatch = url.pathname.match(/\/o\/(.+)\?/);

    if (!pathMatch || !pathMatch[1]) {
      throw new Error(`Invalid storage URL format for deletion: ${imageUrl}`);
    }

    // Decode URI component to handle special characters in paths
    const storagePath = decodeURIComponent(pathMatch[1]);
    const imageRef = ref(storage, storagePath);

    console.log('Attempting to delete image from storage:', storagePath);
    await deleteObject(imageRef);
    console.log('Image deleted successfully from storage.');
  } catch (error) {
    console.error('Error deleting image from storage:', {
      errorCode: error.code || 'NO_FIREBASE_CODE',
      errorMessage: error.message,
      errorOriginal: error,
    });
    // Re-throw to inform the caller if deletion was critical
    throw new Error(`Failed to delete image: ${error.message}`);
  }
};

/**
 * Upload a document file to Firebase Storage
 * @param {string} localUri - Local URI of the document
 * @param {string} folderPath - Storage folder path (e.g., 'driverDocuments', 'vehicleDocuments')
 * @param {string} userId - User ID for organizing files
 * @param {string} filename - Custom filename for the document (e.g., 'license_front.pdf')
 * @returns {Promise<string>} - Download URL of uploaded document
 */
export const uploadDocumentToStorage = async (localUri, folderPath, userId, filename) => {
  try {
    if (!localUri || !folderPath || !userId || !filename) {
      throw new Error('Missing required parameters for document upload: localUri, folderPath, userId, and filename are mandatory.');
    }

    if (!localUri.startsWith('file://')) {
      throw new Error('Invalid document URI format. Expected a file:// URI.');
    }

    console.log('Attempting to fetch document from URI:', localUri);
    const response = await fetch(localUri);
    if (!response.ok) {
      throw new Error(`Failed to fetch document data. HTTP status: ${response.status} - ${response.statusText || 'Unknown Status'}`);
    }
    const blob = await response.blob();
    console.log('Document blob created:', { size: blob.size, type: blob.type });

    if (blob.size === 0) {
        throw new Error('Fetched document blob is empty. Check local URI or document source.');
    }

    const timestamp = Date.now();
    // Prepend timestamp to filename for uniqueness, preserving original filename part
    const documentRef = ref(storage, `${folderPath}/${userId}/${timestamp}_${filename}`);
    console.log('Uploading document to Firebase Storage...');

    const snapshot = await uploadBytes(documentRef, blob);
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('Document uploaded successfully! Download URL:', downloadURL);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading document to storage:', {
      errorCode: error.code || 'NO_FIREBASE_CODE',
      errorMessage: error.message,
      errorOriginal: error,
    });
    throw new Error(`Failed to upload document: ${error.message}`);
  }
};

/**
 * Get all files in a specific user's folder within Firebase Storage.
 * @param {string} folderPath - Storage folder path (e.g., 'profileImages', 'driverDocuments')
 * @param {string} userId - User ID whose files are to be listed
 * @returns {Promise<Array<{name: string, fullPath: string, downloadURL: string}>>} - Array of file metadata
 */
export const getUserFiles = async (folderPath, userId) => {
  try {
    if (!folderPath || !userId) {
      throw new Error('Missing required parameters for getting user files: folderPath and userId are mandatory.');
    }

    const userFolderRef = ref(storage, `${folderPath}/${userId}`);
    console.log('Listing files in folder:', userFolderRef.fullPath);

    const result = await listAll(userFolderRef);

    const files = await Promise.all(
      result.items.map(async (itemRef) => {
        const downloadURL = await getDownloadURL(itemRef);
        return {
          name: itemRef.name,
          fullPath: itemRef.fullPath,
          downloadURL,
        };
      })
    );
    console.log(`Found ${files.length} files for user ${userId} in folder ${folderPath}.`);
    return files;
  } catch (error) {
    console.error('Error getting user files from storage:', {
      errorCode: error.code || 'NO_FIREBASE_CODE',
      errorMessage: error.message,
      errorOriginal: error,
    });
    throw new Error(`Failed to get user files: ${error.message}`);
  }
};

/**
 * Clean up all files for a specific user within a given folder path (useful for account deletion, etc.).
 * @param {string} folderPath - Storage folder path
 * @param {string} userId - User ID whose files are to be deleted
 * @returns {Promise<void>}
 */
export const deleteAllUserFiles = async (folderPath, userId) => {
  try {
    if (!folderPath || !userId) {
      throw new Error('Missing required parameters for deleting all user files: folderPath and userId are mandatory.');
    }

    const userFolderRef = ref(storage, `${folderPath}/${userId}`);
    console.log('Listing all files for deletion in:', userFolderRef.fullPath);
    const result = await listAll(userFolderRef);

    if (result.items.length === 0) {
      console.log(`No files found for user ${userId} in folder ${folderPath}. Nothing to delete.`);
      return;
    }

    console.log(`Found ${result.items.length} files to delete for user ${userId}.`);
    const deletePromises = result.items.map(itemRef => deleteObject(itemRef));
    await Promise.all(deletePromises);

    console.log(`All ${result.items.length} files deleted successfully for user ${userId} in folder ${folderPath}.`);
  } catch (error) {
    console.error('Error deleting all user files from storage:', {
      errorCode: error.code || 'NO_FIREBASE_CODE',
      errorMessage: error.message,
      errorOriginal: error,
    });
    throw new Error(`Failed to delete all user files: ${error.message}`);
  }
};

// Predefined folder paths for consistency and easier use
export const STORAGE_FOLDERS = {
  PROFILE_IMAGES: 'profileImages',
  DRIVER_PROFILE_IMAGES: 'driverProfileImages',
  DRIVER_DOCUMENTS: 'driverDocuments',
  VEHICLE_DOCUMENTS: 'vehicleDocuments',
  LICENSES: 'licenses',
  INSURANCE_DOCS: 'insuranceDocs',
};