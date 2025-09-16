
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

  // Enhanced update function with detailed logging
  const updateField = useCallback((field: keyof T, value: any) => {
    console.log('🔄 updateField called:', {
      field,
      value,
      type: typeof value,
      previousValue: formData[field]
    });
    
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
      
      // Log the localStorage write operation
      try {
        const storageKey = key;
        const serializedData = JSON.stringify(newData);
        console.log('💾 Writing to localStorage:', {
          key: storageKey,
          field,
          newValue: value,
          fullData: newData,
          serializedLength: serializedData.length
        });
        
        // Special logging for parent entity fields
        if (field === 'parentEntityId' || field === 'parentEntityName') {
          console.log('🏷️ Parent entity update:', {
            field,
            value,
            parentEntityId: newData.parentEntityId,
            parentEntityName: newData.parentEntityName,
            bothFieldsPresent: !!(newData.parentEntityId && newData.parentEntityName)
          });
        }
      } catch (error) {
        console.error('❌ localStorage serialization error:', error);
      }
      
      return newData;
    });
  }, [setFormData, formData, key]);

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
  const validateFormIntegrity = useCallback((validationType: 'brand' | 'all' = 'all', currentFormData?: T) => {
    // Use provided form data or fall back to current hook state
    const dataToValidate = currentFormData || formData;
    const hasParentName = dataToValidate.parentEntityName && dataToValidate.parentEntityName.trim();
    const hasParentId = dataToValidate.parentEntityId && dataToValidate.parentEntityId.trim();
    
    console.log('🔍 Form integrity check:', {
      validationType,
      hasParentName: !!hasParentName,
      hasParentId: !!hasParentId,
      parentEntityName: dataToValidate.parentEntityName,
      parentEntityId: dataToValidate.parentEntityId,
      usingProvidedData: !!currentFormData
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
  }, [formData]);

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
