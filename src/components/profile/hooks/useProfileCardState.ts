
import { useState, useEffect } from 'react';

interface UseProfileCardStateProps {
  username: string;
  bio: string;
  location: string;
  firstName: string;
  lastName: string;
  profileImage: string;
  onProfileImageChange?: (url: string) => void;
}

export const useProfileCardState = ({
  username,
  bio,
  location,
  firstName,
  lastName,
  profileImage
}: UseProfileCardStateProps) => {
  const [currentUsername, setCurrentUsername] = useState(username);
  const [currentBio, setCurrentBio] = useState(bio);
  const [currentLocation, setCurrentLocation] = useState(location);
  const [currentFirstName, setFirstName] = useState(firstName);
  const [currentLastName, setLastName] = useState(lastName);
  const [tempProfileImage, setTempProfileImage] = useState<string | null>(null);
  const [localHasChanges, setLocalHasChanges] = useState(false);
  const [databaseUsername, setDatabaseUsername] = useState<string>('');

  // Update states when props change
  useEffect(() => {
    setCurrentUsername(username);
    setCurrentBio(bio);
    setCurrentLocation(location);
  }, [username, bio, location]);

  // Check if there are changes to save
  useEffect(() => {
    setLocalHasChanges(!!tempProfileImage);
  }, [tempProfileImage]);

  const handleProfileUpdate = (
    newUsername: string,
    newBio: string,
    newLocation: string,
    newFirstName: string,
    newLastName: string
  ) => {
    setCurrentUsername(newUsername);
    setCurrentBio(newBio);
    setCurrentLocation(newLocation);
    setFirstName(newFirstName);
    setLastName(newLastName);
    setDatabaseUsername(newUsername);
  };

  return {
    currentUsername,
    currentBio,
    currentLocation,
    currentFirstName,
    currentLastName,
    tempProfileImage,
    setTempProfileImage,
    localHasChanges,
    setLocalHasChanges,
    databaseUsername,
    setDatabaseUsername,
    handleProfileUpdate
  };
};
