import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Youtube, Image as ImageIcon, Upload, Play, CheckCircle2, AlertCircle,
  AlignLeft, AlignCenter, AlignRight, Loader2, FileText,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { extractYouTubeId } from '../lib/youtube';
import { uploadImageFile } from '../firebase';
import { compressImageFile, resolveLocalImage } from '../utils/mediaStore';

/** Modal components extracted from App.tsx (behaviour unchanged). */
export type MediaAlign = 'left' | 'center' | 'right';
export type MediaSize = 'small' | 'medium' | 'large' | 'full';


interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'primary';
}

export const ConfirmModal = ({ isOpen, title, message, confirmLabel = "Delete", cancelLabel = "Cancel", onConfirm, onCancel, variant = 'danger' }: ConfirmModalProps) => (
  <AnimatePresence>
    {isOpen && (
      <div
        role="dialog" aria-modal="true" aria-label={title}
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md bg-surface border border-white/10 rounded-2xl p-6 shadow-2xl relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={onCancel} className="absolute top-4 right-4 text-text/40 hover:text-text"><X className="w-5 h-5" /></button>
          <h3 className="text-xl font-bold text-text mb-2">{title}</h3>
          <p className="text-text/60 mb-8">{message}</p>
          <div className="flex justify-end gap-3">
            <button onClick={onCancel} className="px-6 py-2 rounded-xl hover:bg-white/5 transition-colors text-sm font-medium">{cancelLabel}</button>
            <button
              onClick={onConfirm}
              className={cn(
                "px-6 py-2 rounded-xl transition-colors text-sm font-medium",
                variant === 'danger' ? "bg-red-500 text-text hover:bg-red-600" : "bg-accent text-on-accent hover:bg-accent/90"
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  defaultValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export const PromptModal = ({ isOpen, title, defaultValue, onConfirm, onCancel }: PromptModalProps) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue, isOpen]);

  const handleSubmit = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const finalVal = (value || inputRef.current?.value || '').trim();
    if (finalVal) {
      onConfirm(finalVal);
    } else {
      onCancel();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog" aria-modal="true" aria-label={title}
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onCancel();
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md bg-surface border border-white/10 rounded-2xl p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onCancel}
              className="absolute top-4 right-4 text-text/40 hover:text-text cursor-pointer p-1 rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-text mb-6">{title}</h3>
            <form

              onSubmit={handleSubmit}
              className="space-y-6"
            >
              <input
                ref={inputRef}
                autoFocus
                type="text"
                enterKeyHint="done"
                autoComplete="off"
                autoCorrect="off"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.keyCode === 13) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSubmit();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    onCancel();
                  }
                }}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-accent transition-colors text-text text-base"
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-6 py-2 rounded-xl hover:bg-white/5 transition-colors text-sm font-medium text-neutral-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSubmit();
                  }}
                  className="px-6 py-2 rounded-xl bg-accent text-on-accent hover:bg-accent/90 transition-colors text-sm font-bold cursor-pointer active:scale-95 shadow-md"
                >
                  Save
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// YouTube Extraction Helper

interface YouTubeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (url: string, align: 'left' | 'center' | 'right', size: 'small' | 'medium' | 'large' | 'full') => void;
}

export const YouTubeModal = ({ isOpen, onClose, onInsert }: YouTubeModalProps) => {
  const [url, setUrl] = useState('');
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('center');
  const [size, setSize] = useState<'small' | 'medium' | 'large' | 'full'>('medium');

  useEffect(() => {
    if (isOpen) {
      setUrl('');
      setAlign('center');
      setSize('medium');
    }
  }, [isOpen]);

  const extracted = extractYouTubeId(url);
  const isValid = Boolean(extracted);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isValid || !extracted) return;
    onInsert(url, align, size);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-lg bg-surface border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-5 right-5 text-text/40 hover:text-text transition-colors p-1 rounded-lg hover:bg-white/5"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                <Youtube className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-text">Embed YouTube Video</h3>
                <p className="text-xs text-text/50">Stream videos directly inside your note with custom resizing</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text/60 mb-2">
                  YouTube Video Link
                </label>
                <div className="relative">
                  <input
                    autoFocus
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                    className={cn(
                      "w-full bg-white/5 border rounded-2xl px-4 py-3 text-sm outline-none transition-all placeholder:text-text/30",
                      url && isValid && "border-green-500/50 focus:border-green-500",
                      url && !isValid && "border-red-500/50 focus:border-red-500",
                      !url && "border-white/10 focus:border-accent"
                    )}
                  />
                  {url && (
                    <div className="absolute right-3 top-3.5 flex items-center">
                      {isValid ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                  )}
                </div>

                {url && !isValid && (
                  <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Please enter a valid YouTube video link, shorts, or 11-character video ID.
                  </p>
                )}
                {url && isValid && extracted && (
                  <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Valid YouTube video ready to insert.
                  </p>
                )}
              </div>

              {/* Video Thumbnail Preview Card */}
              {extracted && (
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black/60 group shadow-lg">
                  <img
                    src={`https://img.youtube.com/vi/${extracted.videoId}/mqdefault.jpg`}
                    alt="Video thumbnail"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-red-600/90 text-text flex items-center justify-center shadow-xl">
                      <Play className="w-6 h-6 fill-white ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] text-text/90 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                    <span className="font-mono">ID: {extracted.videoId}</span>
                    {extracted.startTime ? (
                      <span className="text-accent font-medium">Starts @ {extracted.startTime}s</span>
                    ) : (
                      <span className="text-text/60">Full Video</span>
                    )}
                  </div>
                </div>
              )}

              {/* Size Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text/60 mb-2">
                  Player Size
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSize('small')}
                    className={cn(
                      "py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all flex flex-col items-center gap-1",
                      size === 'small'
                        ? "bg-accent text-on-accent border-accent shadow-md shadow-accent/10"
                        : "bg-white/5 border-white/10 text-text/70 hover:bg-white/10 hover:text-text"
                    )}
                  >
                    <span>Small</span>
                    <span className={cn("text-[10px]", size === 'small' ? "text-on-accent/70" : "text-text/40")}>35% width</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSize('medium')}
                    className={cn(
                      "py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all flex flex-col items-center gap-1",
                      size === 'medium'
                        ? "bg-accent text-on-accent border-accent shadow-md shadow-accent/10"
                        : "bg-white/5 border-white/10 text-text/70 hover:bg-white/10 hover:text-text"
                    )}
                  >
                    <span>Medium</span>
                    <span className={cn("text-[10px]", size === 'medium' ? "text-on-accent/70" : "text-text/40")}>65% width</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSize('large')}
                    className={cn(
                      "py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all flex flex-col items-center gap-1",
                      size === 'large'
                        ? "bg-accent text-on-accent border-accent shadow-md shadow-accent/10"
                        : "bg-white/5 border-white/10 text-text/70 hover:bg-white/10 hover:text-text"
                    )}
                  >
                    <span>Large</span>
                    <span className={cn("text-[10px]", size === 'large' ? "text-on-accent/70" : "text-text/40")}>85% width</span>
                  </button>
                  <button type="button" onClick={() => setSize('full')} className={cn("py-2.5 px-3 rounded-xl border text-xs", size === 'full' ? "bg-accent text-on-accent" : "bg-white/5 text-text")}><span>Full</span><br /><span>100% width</span></button>
                </div>
              </div>

              {/* Alignment Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text/60 mb-2">
                  Alignment
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAlign('left')}
                    className={cn(
                      "py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-2",
                      align === 'left'
                        ? "bg-accent text-on-accent border-accent shadow-md shadow-accent/10"
                        : "bg-white/5 border-white/10 text-text/70 hover:bg-white/10 hover:text-text"
                    )}
                  >
                    <AlignLeft className="w-4 h-4" /> Left
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlign('center')}
                    className={cn(
                      "py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-2",
                      align === 'center'
                        ? "bg-accent text-on-accent border-accent shadow-md shadow-accent/10"
                        : "bg-white/5 border-white/10 text-text/70 hover:bg-white/10 hover:text-text"
                    )}
                  >
                    <AlignCenter className="w-4 h-4" /> Center
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlign('right')}
                    className={cn(
                      "py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-2",
                      align === 'right'
                        ? "bg-accent text-on-accent border-accent shadow-md shadow-accent/10"
                        : "bg-white/5 border-white/10 text-text/70 hover:bg-white/10 hover:text-text"
                    )}
                  >
                    <AlignRight className="w-4 h-4" /> Right
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl hover:bg-white/5 text-text/70 hover:text-text transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isValid}
                  className="px-6 py-2.5 rounded-xl bg-accent text-on-accent hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-bold flex items-center gap-2 shadow-lg shadow-accent/10"
                >
                  <Youtube className="w-4 h-4" /> Insert Video
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onInsert: (url: string, alt: string, align: 'left' | 'center' | 'right', size: 'small' | 'medium' | 'large' | 'full') => Promise<boolean> | boolean | void;
}

export const cleanImageUrl = (input: string): string => {
  if (!input) return '';
  let trimmed = input.trim();
  // Strip enclosing quotes
  trimmed = trimmed.replace(/^["']|["']$/g, '');
  // Extract URL from markdown format ![alt](url) if pasted
  const mdMatch = trimmed.match(/!\[.*?\]\(([^()]+)\)/i);
  if (mdMatch) return mdMatch[1].trim();
  // Extract URL from HTML format <img src="url"> if pasted
  const htmlMatch = trimmed.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (htmlMatch) return htmlMatch[1].trim();
  // Auto prefix https:// if domain starts with www. or domain path
  if (/^(www\.|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\/)/i.test(trimmed) && !trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:') && !trimmed.startsWith('/')) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

export const ImageModal = ({ isOpen, onClose, userId, onInsert }: ImageModalProps) => {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('center');
  const [size, setSize] = useState<'small' | 'medium' | 'large' | 'full'>('medium');
  const [isUploading, setIsUploading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setUrl('');
      setAlt('');
      setSelectedFile(null);
      setPreviewUrl(null);
      setAlign('center');
      setSize('medium');
      setIsUploading(false);
      setImgError(false);
      setUploadError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setImgError(false);
    setUploadError(null);
  }, [url]);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setUploadError(null);
    if (!alt) {
      setAlt(file.name.replace(/\.[^/.]+$/, ""));
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleUrlPaste = (e: React.ClipboardEvent) => {
    const clipboardFiles = e.clipboardData?.files;
    if (clipboardFiles && clipboardFiles.length > 0) {
      const file = clipboardFiles[0];
      if (file.type.startsWith('image/')) {
        e.preventDefault();
        setMode('upload');
        handleFileSelect(file);
        return;
      }
    }

    const pastedText = e.clipboardData?.getData('text');
    if (pastedText) {
      const cleaned = cleanImageUrl(pastedText);
      if (cleaned) {
        e.preventDefault();
        setUrl(cleaned);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        handleFileSelect(file);
      }
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setUploadError(null);
    if (mode === 'url') {
      const finalUrl = cleanImageUrl(url);
      if (!finalUrl) return;
      setIsUploading(true);
      try {
        const ok = await onInsert(finalUrl, alt.trim() || 'Image', align, size);
        if (ok !== false) onClose();
        else setUploadError('The image could not be inserted. It has not been added to the note — see the message above and try again.');
      } catch (err: any) {
        setUploadError(err?.message || 'The image could not be inserted. Please try again.');
      } finally { setIsUploading(false); }
    } else {
      if (!selectedFile) return;
      setIsUploading(true);
      try {
        const fileToUpload = await compressImageFile(selectedFile);
        const uploadedUrl = await uploadImageFile(userId, fileToUpload, selectedFile.name);
        const ok = await onInsert(uploadedUrl, alt.trim() || selectedFile.name.replace(/\.[^/.]+$/, ""), align, size);
        if (ok !== false) onClose();
        else setUploadError('The image could not be inserted. It has not been added to the note — see the message above and try again.');
      } catch (err: any) {
        setUploadError(err?.message || "Failed to upload image. Please try again.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-lg bg-surface border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-5 right-5 text-text/40 hover:text-text transition-colors p-1 rounded-lg hover:bg-white/5"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-text">Insert Image</h3>
                <p className="text-xs text-text/50">Upload or link images cleanly with customizable sizing</p>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl border border-white/10 mb-4">
              <button
                type="button"
                onClick={() => setMode('upload')}
                className={cn(
                  "py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2",
                  mode === 'upload' ? "bg-accent text-on-accent shadow-md" : "text-text/60 hover:text-text"
                )}
              >
                <Upload className="w-3.5 h-3.5" /> Upload File
              </button>
              <button
                type="button"
                onClick={() => setMode('url')}
                className={cn(
                  "py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2",
                  mode === 'url' ? "bg-accent text-on-accent shadow-md" : "text-text/60 hover:text-text"
                )}
              >
                <FileText className="w-3.5 h-3.5" /> Web Link
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'upload' ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                    }}
                    className="hidden"
                  />
                  {!selectedFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      className="border-2 border-dashed border-white/10 hover:border-accent/50 rounded-2xl p-6 text-center cursor-pointer transition-all hover:bg-white/5 flex flex-col items-center justify-center gap-2"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-text/40">
                        <Upload className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-medium text-text">Click or drag & drop image here</p>
                      <p className="text-xs text-text/40">Supports PNG, JPG, WebP, GIF, SVG</p>
                    </div>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 p-2 flex items-center gap-3">
                      {previewUrl && (
                        <img src={previewUrl} alt="Preview" className="w-16 h-16 object-cover rounded-xl border border-white/10 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-xs font-medium text-text truncate">{selectedFile.name}</p>
                        <p className="text-[11px] text-text/40">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-text/40 hover:text-red-400 transition-colors mr-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text/60 mb-2">
                    Image URL
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onPaste={handleUrlPaste}
                    placeholder="Paste image link or https://example.com/image.png"
                    className="w-full bg-white/5 border border-white/10 focus:border-accent rounded-2xl px-4 py-3 text-sm outline-none transition-all placeholder:text-text/30 text-text"
                  />
                  {url.trim() !== '' && (
                    <div className="mt-3 relative rounded-2xl overflow-hidden border border-white/10 bg-black/50 p-2 text-center min-h-[100px] flex flex-col items-center justify-center">
                      {!imgError ? (
                        <img
                          key={cleanImageUrl(url)}
                          src={resolveLocalImage(cleanImageUrl(url))}
                          alt={alt || "Image preview"}
                          className="max-h-40 w-auto object-contain rounded-xl shadow-md"
                          onError={() => setImgError(true)}
                        />
                      ) : (
                        <div className="p-3 text-xs text-amber-400/90 flex flex-col items-center gap-1">
                          <AlertCircle className="w-5 h-5 text-amber-400 mb-1" />
                          <span>Preview blocked by host CORS policy</span>
                          <span className="text-[10px] text-text/40">The URL is stored and will be inserted directly into your note</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text/60 mb-2">
                  Alt / Caption (Optional)
                </label>
                <input
                  type="text"
                  value={alt}
                  onChange={(e) => setAlt(e.target.value)}
                  placeholder="Descriptive label for the image"
                  className="w-full bg-white/5 border border-white/10 focus:border-accent rounded-2xl px-4 py-2.5 text-sm outline-none transition-all placeholder:text-text/30"
                />
              </div>

              {/* Sizing Presets */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text/60 mb-2">
                  Display Size
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['small', 'medium', 'large', 'full'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(s)}
                      className={cn(
                        "py-2 px-3 rounded-xl border text-xs font-semibold transition-all flex flex-col items-center gap-0.5",
                        size === s
                          ? "bg-accent text-on-accent border-accent shadow-md shadow-accent/10"
                          : "bg-white/5 border-white/10 text-text/70 hover:bg-white/10 hover:text-text"
                      )}
                    >
                      <span className="capitalize">{s}</span>
                      <span className={cn("text-[10px]", size === s ? "text-on-accent/70" : "text-text/40")}>
                        {s === 'small' ? '35%' : s === 'medium' ? '65%' : s === 'large' ? '85%' : '100%'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Alignment Presets */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text/60 mb-2">
                  Alignment
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAlign('left')}
                    className={cn(
                      "py-2 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-2",
                      align === 'left' ? "bg-accent text-on-accent border-accent" : "bg-white/5 border-white/10 text-text/70 hover:bg-white/10 hover:text-text"
                    )}
                  >
                    <AlignLeft className="w-4 h-4" /> Left
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlign('center')}
                    className={cn(
                      "py-2 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-2",
                      align === 'center' ? "bg-accent text-on-accent border-accent" : "bg-white/5 border-white/10 text-text/70 hover:bg-white/10 hover:text-text"
                    )}
                  >
                    <AlignCenter className="w-4 h-4" /> Center
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlign('right')}
                    className={cn(
                      "py-2 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-2",
                      align === 'right' ? "bg-accent text-on-accent border-accent" : "bg-white/5 border-white/10 text-text/70 hover:bg-white/10 hover:text-text"
                    )}
                  >
                    <AlignRight className="w-4 h-4" /> Right
                  </button>
                </div>
              </div>

              {uploadError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl hover:bg-white/5 text-text/70 hover:text-text transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={(mode === 'upload' && !selectedFile) || (mode === 'url' && !url.trim()) || isUploading}
                  className="px-6 py-2.5 rounded-xl bg-accent text-on-accent hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-bold flex items-center gap-2 shadow-lg shadow-accent/10"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-4 h-4" /> Insert Image
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// Media Layout Helper

