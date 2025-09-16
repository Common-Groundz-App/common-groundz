
import { useCallback, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

export function usePersistedForm<T extends Record<string, any>>(
  key: string,
  initialFormData: T
) {
  const [formData, setFormData, clearFormData] = useLocalStorage(key, initialFormData);

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

  // Debounced update function with enhanced logging
  const updateField = useCallback((field: keyof T, value: any) => {
    console.log('🔧 updateField called:', {
      field: String(field),
      value,
      type: typeof value,
      isNull: value === null,
      isUndefined: value === undefined
    });
    
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
      
      // Extra validation for critical fields
      if (field === 'parentEntityId' || field === 'parentEntityName') {
        console.log('🚨 CRITICAL FIELD UPDATE:', {
          field: String(field),
          oldValue: prev[field],
          newValue: value,
          parentEntityId: newData.parentEntityId,
          parentEntityName: newData.parentEntityName,
          storageKey: key
        });
        
        // Log to localStorage immediately for debugging
        try {
          window.localStorage.setItem(`${key}_debug`, JSON.stringify({
            timestamp: new Date().toISOString(),
            field: String(field),
            value,
            fullData: newData
          }));
        } catch (e) {
          console.warn('Failed to write debug data:', e);
        }
      }
      
      console.log('📝 Form data updated:', {
        field: String(field),
        oldValue: prev[field],
        newValue: value,
        fullData: newData
      });
      return newData;
    });
  }, [setFormData, key]);

  // Reset to initial state
  const resetForm = useCallback(() => {
    setFormData(initialFormData);
  }, [setFormData, initialFormData]);

  // Clear persisted data
  const clearPersistedData = useCallback(() => {
    clearFormData();
  }, [clearFormData]);

  // Clear inconsistent parent data on initialization
  const clearInconsistentData = useCallback(() => {
    const hasParentName = formData.parentEntityName && formData.parentEntityName.trim();
    const hasParentId = formData.parentEntityId && formData.parentEntityId.trim();
    
    if (hasParentName && !hasParentId) {
      console.log('🧹 Clearing inconsistent parent data on initialization');
      updateField('parentEntityName', '');
      updateField('parentEntityId', '');
    }
  }, [formData.parentEntityName, formData.parentEntityId, updateField]);

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
