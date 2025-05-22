
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface GenrePreferencesStepProps {
  onChange: (data: Record<string, any>) => void;
  initialData: Record<string, any>;
}

const genres = ['Action', 'Sci-Fi', 'Romcom', 'Thriller', 'Drama', 'Anime', 'Other'];

const GenrePreferencesStep: React.FC<GenrePreferencesStepProps> = ({ onChange, initialData }) => {
  const [selectedGenres, setSelectedGenres] = useState<string[]>(initialData.genre_preferences || []);
  const [otherGenre, setOtherGenre] = useState<string>(initialData.other_genres || '');
  const [showOther, setShowOther] = useState<boolean>((initialData.genre_preferences || []).includes('Other'));

  useEffect(() => {
    const data: Record<string, any> = { genre_preferences: selectedGenres };
    if (showOther && otherGenre) {
      data.other_genres = otherGenre;
    }
    onChange(data);
  }, [selectedGenres, otherGenre, showOther, onChange]);

  const handleGenreChange = (value: string) => {
    let newSelected;
    
    if (selectedGenres.includes(value)) {
      newSelected = selectedGenres.filter(item => item !== value);
    } else {
      newSelected = [...selectedGenres, value];
    }
    
    setSelectedGenres(newSelected);
    
    if (value === 'Other') {
      setShowOther(!showOther);
      if (showOther) {
        setOtherGenre('');
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="genre-preferences">What genres do you enjoy?</Label>
        <p className="text-sm text-muted-foreground">Select all that apply</p>
        
        <div className="flex flex-wrap gap-2 mt-2">
          {genres.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => handleGenreChange(genre)}
              className={`px-4 py-2 rounded-full border text-sm
                ${selectedGenres.includes(genre) 
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted/50 border-input'
                }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {showOther && (
        <div className="space-y-2 pt-2">
          <Label htmlFor="other-genres">Please specify other genres:</Label>
          <Input
            id="other-genres"
            placeholder="e.g., Documentary, Horror, Fantasy"
            value={otherGenre}
            onChange={(e) => setOtherGenre(e.target.value)}
          />
        </div>
      )}
    </div>
  );
};

export default GenrePreferencesStep;
