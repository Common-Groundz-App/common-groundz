
import { useCallback, useEffect, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';

export function usePersistedForm<T extends Record<string, any>>(
  key: string,
  initialFormData: T
) {
  const [formData, setFormData, clearFormData] = useLocalStorage(key, initialFormData);
  const hasRunCleanup = useRef(false);

  // Enhanced debugging for localStorage
  useEffect(() => {
    const stored = window.localStorage.getItem(key);
    console.log('🔍 usePersistedForm initialized:', {
      key,
      storedValue: stored,
      parsedValue: stored ? JSON.parse(stored) : null,
      currentFormData: formData
    });
  }, [key]);

  // Debounced update function with reduced logging
  const updateField = useCallback((field: keyof T, value: any) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
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

  // Clear inconsistent parent data on initialization (runs once)
  const clearInconsistentData = useCallback(() => {
    // Only run once to prevent infinite loops
    if (hasRunCleanup.current) {
      return;
    }
    
    setFormData(current => {
      const hasParentName = current.parentEntityName && current.parentEntityName.trim();
      const hasParentId = current.parentEntityId && current.parentEntityId.trim();
      
      if (hasParentName && !hasParentId) {
        console.log('🧹 Clearing inconsistent parent data on initialization');
        hasRunCleanup.current = true;
        return {
          ...current,
          parentEntityName: '',
          parentEntityId: ''
        };
      } else {
        hasRunCleanup.current = true;
        return current;
      }
    });
  }, [setFormData]);

  // Step-aware validation function
  const validateFormIntegrity = useCallback((validationType: 'brand' | 'all' = 'all') => {
    const hasParentName = formData.parentEntityName && formData.parentEntityName.trim();
    const hasParentId = formData.parentEntityId && formData.parentEntityId.trim();
    
    console.log('🔍 Form integrity check:', {
      validationType,
      hasParentName: !!hasParentName,
      hasParentId: !!hasParentId,
      parentEntityName: formData.parentEntityName,
      parentEntityId: formData.parentEntityId
    });
    
    // Only check brand consistency if specifically requested
    if (validationType === 'brand') {
      return {
        isValid: !hasParentName || hasParentId, // If has name, must have ID
        hasInconsistency: hasParentName && !hasParentId,
        parentName: hasParentName,
        parentId: hasParentId
      };
    }
    
    // For 'all' validation, return basic validity
    return {
      isValid: true,
      hasInconsistency: false,
      parentName: hasParentName,
      parentId: hasParentId
    };
  }, [formData.parentEntityName, formData.parentEntityId]);

  return {
    formData,
    setFormData,
    updateField,
    resetForm,
    clearPersistedData,
    clearInconsistentData,
    validateFormIntegrity
  };
}
