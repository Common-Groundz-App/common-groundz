
import { useCallback, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

export function usePersistedForm<T extends Record<string, any>>(
  key: string,
  initialFormData: T
) {
  const [formData, setFormData, clearFormData] = useLocalStorage(key, initialFormData);

  // Debounced update function
  const updateField = useCallback((field: keyof T, value: any) => {
    console.log('🔧 updateField called:', {
      field: String(field),
      value,
      type: typeof value
    });
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
      console.log('📝 Form data updated:', {
        field: String(field),
        oldValue: prev[field],
        newValue: value,
        fullData: newData
      });
      return newData;
    });
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
