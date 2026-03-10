/**
 * Delivery Evidence Viewer Component
 *
 * Displays delivery evidence (screenshots, videos) for buyers
 */

'use client'

import React, { useState } from 'react'
import { FileImage, FileVideo, Eye, X, Download } from 'lucide-react'
import Image from 'next/image'

interface DeliveryEvidenceViewerProps {
  evidenceUrls: string[]
}

export default function DeliveryEvidenceViewer({ evidenceUrls }: DeliveryEvidenceViewerProps) {
  const [selectedEvidence, setSelectedEvidence] = useState<string | null>(null)

  if (!evidenceUrls || evidenceUrls.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <FileImage className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No delivery evidence uploaded yet</p>
      </div>
    )
  }

  const isVideo = (url: string) => {
    return url.includes('.mp4') || url.includes('.webm') || url.includes('video')
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {evidenceUrls.map((url, index) => (
          <div
            key={index}
            className="group relative aspect-square rounded-lg overflow-hidden border border-white/[0.1] bg-white/[0.02] cursor-pointer"
            onClick={() => setSelectedEvidence(url)}
          >
            {isVideo(url) ? (
              <div className="w-full h-full flex items-center justify-center bg-black">
                <FileVideo className="w-12 h-12 text-violet-400" />
              </div>
            ) : (
              <div className="relative w-full h-full">
                <Image
                  src={url}
                  alt={`Delivery evidence ${index + 1}`}
                  fill
                  className="object-cover"
                />
              </div>
            )}

            {/* Overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Eye className="w-8 h-8 text-white" />
            </div>

            {/* Badge */}
            <div className="absolute top-2 right-2 px-2 py-1 bg-black/80 rounded text-xs text-white">
              #{index + 1}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedEvidence && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4"
          onClick={() => setSelectedEvidence(null)}
        >
          <div className="relative w-full max-w-5xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              onClick={() => setSelectedEvidence(null)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Download Button */}
            <a
              href={selectedEvidence}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="absolute -top-12 right-12 p-2 text-white hover:text-gray-300 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="w-6 h-6" />
            </a>

            {/* Content */}
            <div className="relative w-full h-full flex items-center justify-center">
              {isVideo(selectedEvidence) ? (
                <video
                  src={selectedEvidence}
                  controls
                  className="max-w-full max-h-[90vh] rounded-lg"
                  autoPlay
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="relative w-full h-full max-h-[90vh]">
                  <Image
                    src={selectedEvidence}
                    alt="Delivery evidence"
                    width={1200}
                    height={800}
                    className="max-w-full max-h-[90vh] object-contain rounded-lg"
                  />
                </div>
              )}
            </div>

            {/* Navigation */}
            {evidenceUrls.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {evidenceUrls.map((url, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedEvidence(url)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      url === selectedEvidence
                        ? 'bg-violet-400 w-8'
                        : 'bg-white/30 hover:bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
