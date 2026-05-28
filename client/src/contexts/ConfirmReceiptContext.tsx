import { createContext, useContext } from 'react';
import { useConfirmReceiptForm } from '@/hooks/useConfirmReceiptForm';

export type ConfirmReceiptContextType = ReturnType<typeof useConfirmReceiptForm>;

export const ConfirmReceiptContext = createContext<ConfirmReceiptContextType | null>(null);

export const useConfirmReceiptContext = () => {
  const context = useContext(ConfirmReceiptContext);
  if (!context) {
    throw new Error('useConfirmReceiptContext must be used within ConfirmReceiptProvider');
  }
  return context;
};
