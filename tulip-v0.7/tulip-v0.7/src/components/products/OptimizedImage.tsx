import React, { useState, useCallback, useRef, useEffect } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackText?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjUzMyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjUzMyIgZmlsbD0iI2YxZjFmMSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iI2FhYSI+SW1hZ2U8L3RleHQ+PC9zdmc+';

const OptimizedImage: React.FC<OptimizedImageProps> = React.memo(({ src, alt, className = '', fallbackText }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleLoad = useCallback(() => setLoaded(true), []);
  const handleError = useCallback(() => {
    setError(true);
    setLoaded(true);
  }, []);

  // Reset state when src changes
  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

  const imgSrc = error
    ? (fallbackText ? `https://placehold.co/300x400/f3f4f6/a3a3a3?text=${encodeURIComponent(fallbackText)}` : PLACEHOLDER)
    : src;

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 bg-secondary animate-pulse" />
      )}
      <img
        ref={imgRef}
        src={imgSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={`${className} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;
