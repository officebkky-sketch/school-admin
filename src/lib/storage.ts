import { supabase, getActiveSchoolProfile } from './supabase';

function getGasUrl(): string {
  const profile = getActiveSchoolProfile();
  return profile?.gasUrl || import.meta.env.VITE_GAS_URL || 'https://script.google.com/macros/s/AKfycbw52uo8upPX6SiZ_W4dD9MUrocA3DkZm3XnE-eU4uE3vvOtOAK4VhXcLIf71PGVsvxj/exec';
}

/**
 * Uploads a file to Supabase Storage (Temporary Staging)
 */
export async function uploadToSupabase(file: File | Blob, bucket: string, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: true
  });

  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return publicUrl;
}

/**
 * Deletes a file from Supabase Storage
 */
export async function deleteFromSupabase(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) console.warn('Supabase delete error:', error);
}

/**
 * Basic upload for legacy support
 */
export async function uploadFile(file: File, bucket: string, folder: string = ''): Promise<string> {
  return uploadFileToDrive(file, folder || bucket, file.name.split('.')[0]);
}

/**
 * Uploads a file to Google Drive via GAS with smart naming.
 */
export async function uploadFileToDrive(file: File, folder: string, customName: string): Promise<string> {
  try {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const fileExt = file.name.split('.').pop();
        const finalFilename = `${customName}.${fileExt}`;
        
        try {
          const response = await fetch(getGasUrl(), {
            method: 'POST',
            body: JSON.stringify({
              folder: folder,
              filename: finalFilename,
              mimeType: file.type,
              base64: base64
            })
          });

          const result = await response.json();
          if (result.status === 'success') {
            resolve(result.url);
          } else {
            reject(new Error(result.message || 'Upload failed'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (error) => reject(error);
    });
  } catch (err) {
    console.error('GAS Upload error:', err);
    throw err;
  }
}

/**
 * Deletes a file from Google Drive via GAS using its URL or ID.
 */
export async function deleteFileFromDrive(fileUrl: string): Promise<boolean> {
  if (!fileUrl) return true;
  
  try {
    // Extract ID from URL if possible (supports both view and download links)
    let fileId = fileUrl;
    const match = fileUrl.match(/[-\w]{25,}/);
    if (match) fileId = match[0];

    const response = await fetch(getGasUrl(), {
      method: 'POST',
      body: JSON.stringify({
        action: 'delete',
        fileId: fileId
      })
    });

    const result = await response.json();
    return result.status === 'success';
  } catch (err) {
    console.error('GAS Delete error:', err);
    return false;
  }
}

