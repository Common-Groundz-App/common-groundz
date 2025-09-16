
import { useCallback, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

export function usePersistedForm<T extends Record<string, any>>(
  key: string,
  initialFormData: T
) {
  const [formData, setFormData, clearFormData] = useLocalStorage(key, initialFormData);

  // Debounced update function
  const updateField = useCallback((field: keyof T, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, [setFormData]);

  // Reset to initial state
  const resetForm = useCallback(() => {
    setFormData(initialFormData);
  }, [setFormData, initialFormData]);

  // Clear persisted data
  const clearPersistedData = useCallback(() => {
    clearFormData();
  }, [clearFormData]);

  return {
    formData,
    setFormData,
    updateField,
    resetForm,
    clearPersistedData
  };
}
