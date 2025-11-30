"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";

interface Photo {
  url: string;
  name: string;
}

export default function GalleryPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string)?.toUpperCase() || "";

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [topic, setTopic] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    if (code) {
      fetchPhotos();
    }
  }, [code]);

  const fetchPhotos = async () => {
    try {
      const response = await fetch(`/api/game-photos?code=${encodeURIComponent(code)}`);
      const data = await response.json();

      if (response.ok) {
        setPhotos(data.photos || []);
        setTopic(data.topic || "Photo Gallery");
      }
    } catch (error) {
      console.error("Error fetching photos:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-3xl font-bold">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-white mb-2">{topic}</h1>
            <p className="text-gray-300 text-lg">Photo Gallery</p>
          </div>

          {photos.length === 0 ? (
            <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-8 text-center">
              <p className="text-gray-300 text-xl">No photos in this game yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((photo, index) => (
                <div
                  key={index}
                  className="relative aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity border-2 border-gray-700"
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <Image
                    src={photo.url}
                    alt={photo.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2">
                    <p className="text-white text-sm font-semibold truncate">{photo.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8">
            <button
              onClick={() => router.push(`/game/${code}`)}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors cursor-pointer"
            >
              Back to Game
            </button>
          </div>
        </div>
      </div>

      {/* Full-screen photo view */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative w-full h-full max-w-7xl max-h-full">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 z-10 bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
            <div className="relative w-full h-full">
              <Image
                src={selectedPhoto.url}
                alt={selectedPhoto.name}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <p className="text-white text-2xl font-bold bg-black/70 px-4 py-2 rounded-lg inline-block">
                {selectedPhoto.name}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

