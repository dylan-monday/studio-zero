import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Photo } from '../../types';

interface StaticPhoto {
  id: string;
  url: string;
  alt_text?: string;
  caption?: string;
  is_hero?: boolean;
}

interface PhotoGalleryProps {
  maxPhotos?: number;
  staticPhotos?: StaticPhoto[];
}

export function PhotoGallery({ maxPhotos, staticPhotos }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<(Photo | StaticPhoto)[]>([]);
  const [loading, setLoading] = useState(!staticPhotos);
  const [selectedPhoto, setSelectedPhoto] = useState<(Photo | StaticPhoto) | null>(null);

  useEffect(() => {
    if (staticPhotos) {
      setPhotos(staticPhotos);
      setLoading(false);
      return;
    }
    fetchPhotos();
  }, [staticPhotos]);

  const fetchPhotos = async () => {
    try {
      let query = supabase
        .from('photos')
        .select('*')
        .order('display_order', { ascending: true });

      if (maxPhotos) {
        query = query.limit(maxPhotos);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPhotos(data || []);
    } catch (err) {
      console.error('Error fetching photos:', err);
    } finally {
      setLoading(false);
    }
  };

  const heroPhoto = photos.find((p) => p.is_hero) || photos[0];
  const galleryPhotos = photos.filter((p) => p.id !== heroPhoto?.id);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`bg-surface animate-pulse rounded-lg ${
              i === 0 ? 'col-span-2 row-span-2 aspect-[4/3]' : 'aspect-square'
            }`}
          />
        ))}
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="bg-surface rounded-xl p-8 text-center">
        <p className="text-text-secondary">Photos coming soon</p>
      </div>
    );
  }

  return (
    <>
      {/* Gallery Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 rounded-xl overflow-hidden">
        {heroPhoto && (
          <button
            onClick={() => setSelectedPhoto(heroPhoto)}
            className="col-span-2 row-span-2 relative group cursor-pointer"
          >
            <img
              src={heroPhoto.url}
              alt={heroPhoto.alt_text || 'Property photo'}
              className="w-full h-full object-cover aspect-[4/3]"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          </button>
        )}
        {galleryPhotos.slice(0, 4).map((photo) => (
          <button
            key={photo.id}
            onClick={() => setSelectedPhoto(photo)}
            className="relative group cursor-pointer"
          >
            <img
              src={photo.url}
              alt={photo.alt_text || 'Property photo'}
              className="w-full h-full object-cover aspect-square"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={selectedPhoto.url}
            alt={selectedPhoto.alt_text || 'Property photo'}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          {selectedPhoto.caption && (
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-4 py-2 rounded-lg">
              {selectedPhoto.caption}
            </p>
          )}
        </div>
      )}
    </>
  );
}
