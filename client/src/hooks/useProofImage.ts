import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/apiErrorHelper';
import { processProofImageFile } from '@/lib/imageProofHelper';

export function useProofImage() {
  const [imageUrl, setImageUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const processImageFile = useCallback(async (file: File) => {
    setIsProcessingImage(true);
    try {
      const image = await processProofImageFile(file);
      setPreviewUrl(image.dataUrl);
      setImageUrl(image.dataUrl);
      toast.success('แนบรูปหลักฐานแล้ว');
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err, 'เกิดข้อผิดพลาดในการประมวลผลรูปภาพ'));
      return false;
    } finally {
      setIsProcessingImage(false);
    }
  }, []);

  const clearImage = useCallback(() => {
    setPreviewUrl(null);
    setImageUrl('');
    setIsProcessingImage(false);
  }, []);

  return {
    imageUrl,
    previewUrl,
    isProcessingImage,
    processImageFile,
    clearImage,
    setImageUrl,
    setPreviewUrl,
    setIsProcessingImage,
  };
}
