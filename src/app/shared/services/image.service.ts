import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import {
  ArtworkImage,
  ImageUploadRequest,
  ImageUploadResponse,
} from '../models/image.model';
import { environment } from '../../../environments/environment.development';
import { aJpeg } from '../utils/convertir-imagen';

@Injectable({
  providedIn: 'root',
})
export class ImageService {
  private supabaseService = inject(SupabaseService);
  private readonly BUCKET_NAME = 'imagenes-obras';

  /** SupabaseService puede sustituir el cliente con reinitializeClient(): se relee en cada operación. */
  private async cubo() {
    await this.supabaseService.ensureActiveSession();
    return this.supabaseService.supabaseClient.storage.from(this.BUCKET_NAME);
  }

  async uploadImage(
    imageRequest: ImageUploadRequest
  ): Promise<ImageUploadResponse> {
    try {
      const file = await aJpeg(imageRequest.file);
      const fileExt = file === imageRequest.file ? imageRequest.filename.split('.').pop() : 'jpg';
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const cubo = await this.cubo();
      const { error } = await cubo.upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

      if (error) {
        throw error;
      }

      // Obtener la URL pública
      const { data: urlData } = cubo.getPublicUrl(filePath);

      return {
        url: urlData.publicUrl,
        filename: imageRequest.filename,
        path: filePath,
      };
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  async uploadMultipleImages(
    images: ImageUploadRequest[]
  ): Promise<ImageUploadResponse[]> {
    try {
      const uploadPromises = images.map((image) => this.uploadImage(image));
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error uploading multiple images:', error);
      throw error;
    }
  }

  async deleteImage(filePath: string): Promise<void> {
    try {
      const { error } = await (await this.cubo()).remove([filePath]);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  }

  async deleteMultipleImages(filePaths: string[]): Promise<void> {
    try {
      const { error } = await (await this.cubo()).remove(filePaths);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error deleting multiple images:', error);
      throw error;
    }
  }

  // Método para obtener el path desde una URL
  getPathFromUrl(url: string): string {
    const baseUrl = `${environment.SUPABASE_URL}/storage/v1/object/public/${this.BUCKET_NAME}/`;
    return url.replace(baseUrl, '');
  }

  // Validar tipos de archivo permitidos
  isValidImageType(file: File): boolean {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    return allowedTypes.includes(file.type);
  }

  // Validar tamaño máximo (5MB por defecto)
  isValidImageSize(file: File, maxSizeInMB: number = 5): boolean {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    return file.size <= maxSizeInBytes;
  }
}
