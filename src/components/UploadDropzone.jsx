// UploadDropzone component — file/image upload area
import { useState, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Button } from './ui/moving-border';

export default function UploadDropzone({ onFileSelect, file }) {
  const { t } = useLanguage();
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) onFileSelect(droppedFile);
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) onFileSelect(selected);
  };

  return (
    <div>
      <div
        className={`upload-dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        id="upload-dropzone"
      >
        <div className="upload-dropzone-icon">{t('common.file')}</div>
        <p className="upload-dropzone-text">{t('search.uploadLabel')}</p>
        <Button className="btn btn-secondary upload-dropzone-btn" type="button">
          {t('search.uploadButton')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.txt,.doc,.docx"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          id="file-input"
        />
      </div>

      {file && (
        <div className="uploaded-file">
          <span>{t('common.file')}</span>
          <span>{file.name}</span>
          <Button
            className="uploaded-file-remove-button"
            aria-label={t('common.remove')}
            onClick={(e) => {
              e.stopPropagation();
              onFileSelect(null);
            }}
            borderRadius="9999px"
            contentStyle={{ width: '28px', height: '28px', padding: 0 }}
            showArrow={false}
          >
            X
          </Button>
        </div>
      )}
    </div>
  );
}
